// @vitest-environment node
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyRuntimeNotices } from '../containers/copy-runtime-notices.mjs'

let directory
let runtimeRoot
let sourceRoot
function write(root, name, value) {
  const file = path.join(root, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value)
}
function fixture(name = 'example', version = '1.0.0') {
  const relative = `node_modules/${name}`
  const data = JSON.stringify({ name, version, license: 'MIT' })
  write(runtimeRoot, `${relative}/package.json`, data)
  write(sourceRoot, `${relative}/package.json`, data)
  return relative
}
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-notices-'))
  runtimeRoot = path.join(directory, 'runtime')
  sourceRoot = path.join(directory, 'source')
})
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

describe('runtime notice packaging', () => {
  it('retains original terms and bundled notices for shipped packages only', () => {
    const relative = fixture()
    write(
      sourceRoot,
      `${relative}/LICENSE`,
      'Original copyright\r\nMIT terms\r\n',
    )
    write(
      sourceRoot,
      `${relative}/dist/compiled/library/NOTICE.txt`,
      'Bundled notice\n',
    )
    write(sourceRoot, 'node_modules/build-only/LICENSE', 'Development terms')
    const result = copyRuntimeNotices({ runtimeRoot, sourceRoot })
    expect(result.packages).toEqual([
      {
        name: 'example',
        version: '1.0.0',
        license: 'MIT',
        sourcePath: relative,
        notices: ['LICENSE', 'dist/compiled/library/NOTICE.txt'],
      },
    ])
    const output = path.join(runtimeRoot, 'third-party-notices')
    expect(
      fs.readFileSync(path.join(output, relative, 'LICENSE'), 'utf8'),
    ).toBe('Original copyright\r\nMIT terms\r\n')
    expect(
      fs.readFileSync(
        path.join(output, relative, 'dist/compiled/library/NOTICE.txt'),
        'utf8',
      ),
    ).toBe('Bundled notice\n')
    expect(fs.readdirSync(path.join(output, 'node_modules'))).toEqual([
      'example',
    ])
    expect(
      JSON.parse(fs.readFileSync(path.join(output, 'index.json'), 'utf8')),
    ).toEqual(result)
  })

  it('rejects source identity drift before emitting a notice bundle', () => {
    const relative = fixture()
    write(sourceRoot, `${relative}/LICENSE`, 'Terms')
    write(
      sourceRoot,
      `${relative}/package.json`,
      JSON.stringify({ name: 'example', version: '2.0.0' }),
    )
    expect(() => copyRuntimeNotices({ runtimeRoot, sourceRoot })).toThrow(
      'identity mismatch',
    )
    expect(fs.existsSync(path.join(runtimeRoot, 'third-party-notices'))).toBe(
      false,
    )
  })

  it('rejects missing authoritative notices rather than treating license metadata as terms', () => {
    fixture()
    expect(() => copyRuntimeNotices({ runtimeRoot, sourceRoot })).toThrow(
      'No authoritative notice files',
    )
  })

  it('includes scoped and nested runtime packages and files inside notice directories', () => {
    const outer = fixture('@scope/outer')
    write(sourceRoot, `${outer}/Licenses/vendor.txt`, 'Vendor terms')
    const nested = `${outer}/node_modules/nested`
    for (const root of [runtimeRoot, sourceRoot])
      write(
        root,
        `${nested}/package.json`,
        JSON.stringify({ name: 'nested', version: '2.0.0' }),
      )
    write(sourceRoot, `${nested}/COPYING`, 'Nested terms')
    write(sourceRoot, `${outer}/source.js`, 'Implementation')
    const result = copyRuntimeNotices({ runtimeRoot, sourceRoot })
    expect(result.packages.map(item => [item.name, item.notices])).toEqual([
      ['nested', ['COPYING']],
      ['@scope/outer', ['Licenses/vendor.txt']],
    ])
  })

  it('rejects ambiguous symbolic-link notice sources', () => {
    const relative = fixture()
    write(sourceRoot, 'outside.txt', 'Unrelated terms')
    fs.symlinkSync(
      path.join(sourceRoot, 'outside.txt'),
      path.join(sourceRoot, relative, 'LICENSE'),
    )
    expect(() => copyRuntimeNotices({ runtimeRoot, sourceRoot })).toThrow(
      'Symbolic link',
    )
  })

  it('uses exact supplemental source notices with checked content identity', () => {
    fixture()
    const supplementalRoot = path.join(directory, 'supplemental')
    const terms = 'Original upstream notice\n'
    write(supplementalRoot, 'files/example/LICENSE', terms)
    const supplemental = {
      name: 'example',
      version: '1.0.0',
      sourceCommit: 'a'.repeat(40),
      sourceUrl: 'https://example.com/source',
      unresolved: [],
      notices: [
        {
          path: 'files/example/LICENSE',
          sha256: createHash('sha256').update(terms).digest('hex'),
          sourceUrl: 'https://example.com/LICENSE',
          scope: 'package',
        },
      ],
    }
    write(
      supplementalRoot,
      'manifest.json',
      JSON.stringify({ packages: [supplemental] }),
    )
    const result = copyRuntimeNotices({
      runtimeRoot,
      sourceRoot,
      supplementalRoot,
    })
    expect(result.packages[0].supplemental).toEqual(supplemental)
    expect(
      fs.readFileSync(
        path.join(
          runtimeRoot,
          'third-party-notices/supplemental/files/example/LICENSE',
        ),
        'utf8',
      ),
    ).toBe(terms)
    write(supplementalRoot, 'files/example/LICENSE', 'Altered terms')
    expect(() =>
      copyRuntimeNotices({ runtimeRoot, sourceRoot, supplementalRoot }),
    ).toThrow('notice checksum mismatch')
  })

  it('does not substitute another package version or unresolved supplemental findings', () => {
    fixture()
    const supplementalRoot = path.join(directory, 'supplemental')
    write(
      supplementalRoot,
      'manifest.json',
      JSON.stringify({
        packages: [{ name: 'example', version: '2.0.0', notices: [] }],
      }),
    )
    expect(() =>
      copyRuntimeNotices({ runtimeRoot, sourceRoot, supplementalRoot }),
    ).toThrow('No authoritative notice files')
    write(
      supplementalRoot,
      'manifest.json',
      JSON.stringify({
        packages: [
          {
            name: 'example',
            version: '1.0.0',
            notices: [],
            unresolved: ['Missing original copyright'],
          },
        ],
      }),
    )
    expect(() =>
      copyRuntimeNotices({ runtimeRoot, sourceRoot, supplementalRoot }),
    ).toThrow('Unresolved supplemental notice')
  })

  it('ignores executable launchers while retaining the packages they launch', () => {
    fixture()
    write(sourceRoot, 'node_modules/example/LICENSE', 'Terms')
    write(runtimeRoot, 'node_modules/.bin/placeholder', '')
    fs.symlinkSync(
      '../example/index.js',
      path.join(runtimeRoot, 'node_modules/.bin/example'),
    )
    expect(
      copyRuntimeNotices({ runtimeRoot, sourceRoot }).packages.map(
        item => item.name,
      ),
    ).toEqual(['example'])
  })
})

// @vitest-environment node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  nativeSourceInputs,
  observeRuntime,
  releaseCandidates,
  sha256,
  sourceRpmEntries,
  sourceRpmMap,
  verifyRuntimeSource,
  verifySourceBase,
} from '../release/runtime-source-contract.mjs'

const digest = `sha256:${'a'.repeat(64)}`
const notice = { path: 'LICENSE', sha256: sha256('license') }
const supplemental = { name: 'library', version: '1', notices: [notice] }
const manifest = { packages: [supplemental] }
const candidate = {
  image: 'ghcr.io/example/app',
  imageId: digest,
  manifestDigest: digest,
  candidate: { manifestDigest: digest },
}
function fixture() {
  return {
    candidate: structuredClone(candidate),
    manifest: structuredClone(manifest),
    lock: { sourceRpms: { 'library-1.src.rpm': digest } },
    files: { '/license.pdf': sha256('PDF') },
    observation: {
      imageId: digest,
      files: { '/license.pdf': sha256('PDF') },
      rpms: 'library\t0\t1\t1\tx86_64\tlibrary-1.src.rpm\tMIT\ngpg-pubkey\t0\t1\t1\t(none)\t(none)\tpubkey\n',
      notices: {
        packages: [
          {
            name: 'library',
            version: '1',
            notices: [],
            supplemental: structuredClone(supplemental),
          },
        ],
      },
      supplementalFiles: { LICENSE: notice.sha256 },
    },
  }
}

describe('release corresponding source contract', () => {
  it('binds original notices and actual installed RPM sources to exact image identities', () => {
    const result = verifyRuntimeSource(fixture())
    expect(result).toMatchObject({
      imageId: digest,
      manifestDigest: digest,
      npmPackageCount: 1,
      rpms: [
        {
          name: 'library',
          sourceRpm: 'library-1.src.rpm',
          sourceLayer: digest,
        },
        { kind: 'signing-public-key' },
      ],
    })
  })
  it.each([
    [
      'runtime identity',
      f => {
        f.observation.imageId = 'other'
      },
      /identity mismatch/,
    ],
    [
      'original PDF integrity',
      f => {
        f.observation.files['/license.pdf'] = 'changed'
      },
      /Original runtime notice/,
    ],
    [
      'complete RPM inventory',
      f => {
        f.observation.rpms = 'library'
      },
      /Incomplete/,
    ],
    [
      'corresponding RPM availability',
      f => {
        f.lock.sourceRpms = {}
      },
      /Missing corresponding/,
    ],
    [
      'original npm notices',
      f => {
        f.observation.notices.packages[0].supplemental = undefined
      },
      /Missing runtime package notices/,
    ],
    [
      'packaged source identity',
      f => {
        f.observation.notices.packages[0].supplemental.version = '2'
      },
      /metadata mismatch/,
    ],
    [
      'packaged notice integrity',
      f => {
        f.observation.supplementalFiles.LICENSE = 'changed'
      },
      /supplemental notice mismatch/,
    ],
    [
      'required npm index',
      f => {
        f.observation.notices = null
      },
      /Missing runtime npm/,
    ],
  ])('rejects invalid %s', (_, mutate, message) => {
    const input = fixture()
    mutate(input)
    expect(() => verifyRuntimeSource(input)).toThrow(message)
  })
  it('accepts provisioner without npm dependencies and packages with original notices only', () => {
    const input = fixture()
    input.candidate.image = 'ghcr.io/example/hsa-mtls-provisioner'
    input.observation.notices = null
    expect(verifyRuntimeSource(input).npmPackageCount).toBe(0)
    input.observation.notices = {
      packages: [{ name: 'original', notices: ['COPYING'] }],
    }
    expect(verifyRuntimeSource(input).npmPackageCount).toBe(1)
  })
  it('requires all six exact candidates, including separate demo and HSA roles', () => {
    const metadata = {
      appRuntime: candidate,
      dbJob: candidate,
      demoSeed: candidate,
      testSupport: { hsaDirectoryMock: candidate },
      hsaIntegrationSupport: {
        hsaPersonLookupAdapter: candidate,
        hsaMtlsProvisioner: candidate,
      },
    }
    const role = name => ({
      ...candidate,
      image: `ghcr.io/example/kravhantering-${name}`,
    })
    metadata.appRuntime = role('app-runtime')
    metadata.dbJob = role('db-job')
    metadata.demoSeed = role('demo-seed')
    metadata.testSupport.hsaDirectoryMock = role('hsa-directory-mock')
    metadata.hsaIntegrationSupport.hsaPersonLookupAdapter = role(
      'hsa-person-lookup-adapter',
    )
    metadata.hsaIntegrationSupport.hsaMtlsProvisioner = role(
      'hsa-mtls-provisioner',
    )
    expect(releaseCandidates(metadata)).toHaveLength(6)
    metadata.demoSeed = { ...role('demo-seed'), imageId: 'tag' }
    expect(() => releaseCandidates(metadata)).toThrow(/Exact candidate/)
    metadata.demoSeed = {
      ...role('demo-seed'),
      candidate: { manifestDigest: 'other' },
    }
    expect(() => releaseCandidates(metadata)).toThrow(/Exact candidate/)
    metadata.demoSeed = {
      ...role('demo-seed'),
      manifestDigest: undefined,
      candidate: { manifestDigest: undefined },
    }
    expect(() => releaseCandidates(metadata)).toThrow(/Exact candidate/)
    metadata.demoSeed = role('app-runtime')
    expect(() => releaseCandidates(metadata)).toThrow(/Exact candidate/)
  })
})

function sourceManifest() {
  return {
    packages: [
      {
        unresolved: [],
        sourceEvidence: {
          components: [
            {
              path: 'sources/lib.tar',
              sha256: sha256('source'),
              sourceUrl: 'https://example.test/lib.tar',
            },
          ],
          rustSourceSuperset: [
            { status: 'workspace-source-in-librsvg-archive' },
          ],
          buildRecipeAndPatches: [
            {
              path: 'renamed',
              originalPath: 'patches/lib.patch',
              sha256: sha256('patch'),
              sourceUrl: 'https://example.test/lib.patch',
            },
          ],
        },
      },
    ],
  }
}

describe('original native source inputs', () => {
  it('uses original input paths and public URLs, retaining workspace sources inside their archive', () => {
    expect(nativeSourceInputs(sourceManifest())).toEqual([
      {
        path: 'sources/lib.tar',
        sha256: sha256('source'),
        sourceUrl: 'https://example.test/lib.tar',
      },
      {
        path: 'patches/lib.patch',
        sha256: sha256('patch'),
        sourceUrl: 'https://example.test/lib.patch',
      },
    ])
  })
  it.each([
    ['path escape', { path: '../escape' }],
    ['absolute path', { path: '/escape' }],
    ['unsafe path', { path: 'bad?name' }],
    ['duplicate path', { path: 'patches/lib.patch' }],
    ['invalid digest', { sha256: 'bad' }],
    ['insecure source', { sourceUrl: 'http://example.test/lib' }],
  ])('rejects %s', (_, fields) => {
    const input = sourceManifest()
    Object.assign(input.packages[0].sourceEvidence.components[0], fields)
    expect(() => nativeSourceInputs(input)).toThrow(/Invalid source input/)
  })
  it('requires resolved evidence', () => {
    expect(() => nativeSourceInputs({ packages: [] })).toThrow(/Complete/)
    const input = sourceManifest()
    input.packages[0].unresolved.push('missing source')
    expect(() => nativeSourceInputs(input)).toThrow(/Complete/)
  })
})

describe('runtime source base correspondence', () => {
  it('accepts the selected role and rejects a changed or missing runtime input', () => {
    const lock = { runtimeBaseDigest: digest }
    const registry = {
      units: [
        {
          id: 'ubi-node-runtime',
          selectedReference: `registry.test/image@${digest}`,
        },
      ],
    }
    expect(() => verifySourceBase(lock, registry)).not.toThrow()
    registry.units[0].selectedReference = 'registry.test/image@other'
    expect(() => verifySourceBase(lock, registry)).toThrow(
      /source correspondence/,
    )
    registry.units = []
    expect(() => verifySourceBase(lock, registry)).toThrow(
      /source correspondence/,
    )
  })
})

const temporary = []
afterEach(() => {
  for (const directory of temporary.splice(0))
    fs.rmSync(directory, { recursive: true, force: true })
})
function runtimeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-source-test-'))
  temporary.push(root)
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(
      path.join(root, file),
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  }
  const item = {
    name: 'library',
    version: '1',
    sourcePath: 'node_modules/library',
    notices: ['LICENSE'],
    supplemental,
  }
  write('node_modules/library/package.json', { name: 'library', version: '1' })
  write('node_modules/library/subdir/extra.txt', 'extra')
  write('node_modules/.bin/ignored', 'script')
  write('original.pdf', 'PDF')
  write('third-party-notices/index.json', { packages: [item] })
  write('third-party-notices/node_modules/library/LICENSE', 'license')
  write('third-party-notices/supplemental/LICENSE', 'license')
  return {
    root,
    write,
    item,
    observe: () =>
      observeRuntime(
        root,
        [path.join(root, 'original.pdf')],
        () => 'rpm evidence',
      ),
  }
}
describe('installed runtime source observation', () => {
  it('enumerates installed identities and hashes original direct and supplemental notices', () => {
    const runtime = runtimeFixture()
    const result = runtime.observe()
    expect(result.directNoticeFiles).toEqual({
      'node_modules/library/LICENSE': sha256('license'),
    })
    expect(result.supplementalFiles).toEqual({ LICENSE: sha256('license') })
    expect(result.rpms).toBe('rpm evidence')
    runtime.item.supplemental = undefined
    runtime.write('third-party-notices/index.json', {
      packages: [runtime.item],
    })
    expect(runtime.observe().supplementalFiles).toEqual({})
  })
  it('rejects missing or mismatched npm inventory and unreviewed symlinks', () => {
    const runtime = runtimeFixture()
    runtime.write('third-party-notices/index.json', { packages: [] })
    expect(runtime.observe).toThrow(/inventory differs/)
    runtime.write('third-party-notices/index.json', {
      packages: [{ ...runtime.item, version: 'other' }],
    })
    expect(runtime.observe).toThrow(/inventory differs/)
    fs.symlinkSync('library', path.join(runtime.root, 'node_modules/alias'))
    expect(runtime.observe).toThrow(/symlink/)
  })
  it('accepts a dependency-free runtime and rejects missing notice bytes', () => {
    const runtime = runtimeFixture()
    fs.rmSync(
      path.join(
        runtime.root,
        'third-party-notices/node_modules/library/LICENSE',
      ),
    )
    expect(runtime.observe).toThrow(/ENOENT/)
    fs.rmSync(path.join(runtime.root, 'node_modules'), { recursive: true })
    fs.rmSync(path.join(runtime.root, 'third-party-notices'), {
      recursive: true,
    })
    expect(runtime.observe()).toMatchObject({
      notices: null,
      supplementalFiles: {},
      directNoticeFiles: {},
    })
  })
})

describe('original source image RPM correspondence', () => {
  it('derives only source RPM members from original layer listings', () => {
    expect(
      sourceRpmEntries(
        digest,
        './\n./blobs/sha256/abc\n./rpm_dir/lib-1.0-2.el10.src.rpm\n',
      ),
    ).toEqual([['lib-1.0-2.el10.src.rpm', digest]])
    expect(sourceRpmEntries(digest, './metadata.json\n')).toEqual([])
    expect(() =>
      sourceRpmEntries(digest, './rpm_dir/../outside.src.rpm'),
    ).toThrow(/Invalid source RPM/)
  })
})

it('rejects duplicate source RPM mappings, including duplicate members of one layer', () => {
  const listing = './rpm_dir/lib-1.src.rpm\n'
  expect(sourceRpmMap([{ digest, listing }])).toEqual({
    'lib-1.src.rpm': digest,
  })
  expect(() => sourceRpmMap([{ digest, listing: listing + listing }])).toThrow(
    /Duplicate/,
  )
  expect(() =>
    sourceRpmMap([
      { digest, listing },
      { digest: 'other', listing },
    ]),
  ).toThrow(/Duplicate/)
})

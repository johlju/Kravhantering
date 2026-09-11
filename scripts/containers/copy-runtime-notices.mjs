import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const noticeName = /^(?:licen[cs]es?|notices?|copying|copyright)(?:[._-].*)?$/iu
const packagePath = /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/u

function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

function packageFiles(directory, relative = '') {
  const result = []
  for (const entry of files(directory)) {
    if (entry.name === '.bin') continue
    const name = path.join(relative, entry.name)
    if (entry.isSymbolicLink())
      throw new Error(
        `Symbolic link requires explicit notice correspondence: ${name}`,
      )
    if (entry.isDirectory()) {
      result.push(...packageFiles(path.join(directory, entry.name), name))
    } else if (entry.isFile() && packagePath.test(name)) {
      result.push(name)
    }
  }
  return result
}

function noticeFiles(directory, relative = '', insideNotice = false) {
  const result = []
  for (const entry of files(directory)) {
    if (entry.name === 'node_modules') continue
    const name = path.join(relative, entry.name)
    if (entry.isSymbolicLink())
      throw new Error(
        `Symbolic link requires explicit notice correspondence: ${name}`,
      )
    const selected = insideNotice || noticeName.test(entry.name)
    if (entry.isDirectory()) {
      result.push(
        ...noticeFiles(path.join(directory, entry.name), name, selected),
      )
    } else if (entry.isFile() && selected) {
      result.push(name)
    }
  }
  return result
}

function supplementalFiles(root, entry) {
  if (entry.unresolved?.length) {
    throw new Error(`Unresolved supplemental notice: ${entry.name}`)
  }
  return entry.notices.map(notice => {
    const source = path.resolve(root, notice.path)
    if (!source.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new Error(
        `Supplemental notice path escapes its root: ${notice.path}`,
      )
    }
    const bytes = fs.readFileSync(source)
    if (createHash('sha256').update(bytes).digest('hex') !== notice.sha256) {
      throw new Error(`Supplemental notice checksum mismatch: ${notice.path}`)
    }
    return { source, target: path.join('supplemental', notice.path) }
  })
}

export function copyRuntimeNotices({
  runtimeRoot,
  sourceRoot,
  supplementalRoot,
}) {
  const output = path.join(runtimeRoot, 'third-party-notices')
  const packages = []
  const copies = []
  const supplements = supplementalRoot
    ? JSON.parse(
        fs.readFileSync(path.join(supplementalRoot, 'manifest.json'), 'utf8'),
      ).packages
    : []
  for (const relative of packageFiles(
    path.join(runtimeRoot, 'node_modules'),
    'node_modules',
  )) {
    const sourcePath = path.dirname(relative)
    const shipped = JSON.parse(
      fs.readFileSync(path.join(runtimeRoot, relative), 'utf8'),
    )
    const source = JSON.parse(
      fs.readFileSync(path.join(sourceRoot, relative), 'utf8'),
    )
    if (source.name !== shipped.name || source.version !== shipped.version) {
      throw new Error(`Runtime notice package identity mismatch: ${sourcePath}`)
    }
    const notices = noticeFiles(path.join(sourceRoot, sourcePath)).sort()
    const supplemental = supplements.find(
      entry => entry.name === source.name && entry.version === source.version,
    )
    const additional = supplemental
      ? supplementalFiles(supplementalRoot, supplemental)
      : []
    if (notices.length + additional.length === 0) {
      throw new Error(
        `No authoritative notice files for shipped package: ${sourcePath}`,
      )
    }
    packages.push({
      name: source.name,
      version: source.version,
      license: source.license,
      sourcePath,
      notices,
      ...(supplemental ? { supplemental } : {}),
    })
    for (const notice of notices) {
      const relative = path.join(sourcePath, notice)
      copies.push({ source: path.join(sourceRoot, relative), target: relative })
    }
    copies.push(...additional)
  }
  fs.rmSync(output, { recursive: true, force: true })
  fs.mkdirSync(output, { recursive: true })
  for (const copy of copies) {
    const target = path.join(output, copy.target)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(copy.source, target)
    fs.chmodSync(target, 0o644)
  }
  const result = { packages }
  fs.writeFileSync(
    path.join(output, 'index.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  )
  return result
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [runtimeRoot, sourceRoot, supplementalRoot] = process.argv.slice(2)
  copyRuntimeNotices({ runtimeRoot, sourceRoot, supplementalRoot })
}

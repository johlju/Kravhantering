import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function nativeSourceInputs(manifest) {
  const native = manifest.packages.find(entry => entry.sourceEvidence)
  if (!native || native.unresolved.length) {
    throw new Error('Complete native source evidence is required')
  }
  const evidence = native.sourceEvidence
  const records = [
    ...evidence.components,
    ...evidence.rustSourceSuperset.filter(
      entry => entry.status !== 'workspace-source-in-librsvg-archive',
    ),
    ...evidence.buildRecipeAndPatches,
  ]
  const paths = new Set()
  return records.map(entry => {
    const path = entry.originalPath ?? entry.path
    if (
      !/^[\w+./-]+$/.test(path) ||
      path.startsWith('/') ||
      path.split('/').includes('..') ||
      paths.has(path) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      !entry.sourceUrl.startsWith('https://')
    ) {
      throw new Error(`Invalid source input: ${path}`)
    }
    paths.add(path)
    return { path, sourceUrl: entry.sourceUrl, sha256: entry.sha256 }
  })
}

export function releaseCandidates(metadata) {
  const candidates = [
    metadata.appRuntime,
    metadata.dbJob,
    metadata.demoSeed,
    metadata.testSupport.hsaDirectoryMock,
    metadata.hsaIntegrationSupport.hsaPersonLookupAdapter,
    metadata.hsaIntegrationSupport.hsaMtlsProvisioner,
  ]
  const roles = [
    'app-runtime',
    'db-job',
    'demo-seed',
    'hsa-directory-mock',
    'hsa-person-lookup-adapter',
    'hsa-mtls-provisioner',
  ]
  for (const [index, entry] of candidates.entries()) {
    if (
      !entry?.image?.endsWith(`/kravhantering-${roles[index]}`) ||
      !/^sha256:[a-f0-9]{64}$/.test(entry?.imageId) ||
      !/^sha256:[a-f0-9]{64}$/.test(entry?.manifestDigest) ||
      entry.manifestDigest !== entry.candidate?.manifestDigest
    ) {
      throw new Error(
        'Exact candidate identity is required for source evidence',
      )
    }
  }
  return candidates
}

export function verifySourceBase(lock, registry) {
  const selected = registry.units.find(unit => unit.id === 'ubi-node-runtime')
  if (!selected?.selectedReference.endsWith(`@${lock.runtimeBaseDigest}`)) {
    throw new Error(
      'Runtime base source correspondence must match the selected maintenance input',
    )
  }
}

export function verifyRuntimeSource({
  observation,
  candidate,
  lock,
  manifest,
  files,
}) {
  if (observation.imageId !== candidate.imageId) {
    throw new Error('Source observation image identity mismatch')
  }
  for (const [path, expected] of Object.entries(files)) {
    if (observation.files[path] !== expected) {
      throw new Error(`Original runtime notice checksum mismatch: ${path}`)
    }
  }
  const rpms = observation.rpms
    .trim()
    .split('\n')
    .map(line => {
      const [name, epoch, version, release, architecture, sourceRpm, license] =
        line.split('\t')
      if (!license || !name)
        throw new Error('Incomplete installed RPM evidence')
      if (
        name === 'gpg-pubkey' &&
        sourceRpm === '(none)' &&
        license === 'pubkey'
      ) {
        return { name, version, release, kind: 'signing-public-key' }
      }
      const sourceLayer = lock.sourceRpms[sourceRpm]
      if (!sourceLayer)
        throw new Error(`Missing corresponding RPM source: ${sourceRpm}`)
      return {
        name,
        epoch,
        version,
        release,
        architecture,
        sourceRpm,
        license,
        sourceLayer,
      }
    })
  if (observation.notices) {
    for (const entry of observation.notices.packages) {
      if (!entry.notices.length && !entry.supplemental?.notices.length) {
        throw new Error(`Missing runtime package notices: ${entry.name}`)
      }
      if (entry.supplemental) {
        const expected = manifest.packages.find(
          item => item.name === entry.name && item.version === entry.version,
        )
        if (!isDeepStrictEqual(entry.supplemental, expected)) {
          throw new Error(`Packaged source metadata mismatch: ${entry.name}`)
        }
        for (const notice of entry.supplemental.notices) {
          if (observation.supplementalFiles[notice.path] !== notice.sha256) {
            throw new Error(
              `Packaged supplemental notice mismatch: ${notice.path}`,
            )
          }
        }
      }
    }
  } else if (!candidate.image.endsWith('hsa-mtls-provisioner')) {
    throw new Error('Missing runtime npm notice index')
  }
  return {
    image: candidate.image,
    imageId: candidate.imageId,
    manifestDigest: candidate.manifestDigest,
    rpms,
    npmPackageCount: observation.notices?.packages.length ?? 0,
    originalFiles: observation.files,
    directNoticeFiles: observation.directNoticeFiles,
  }
}

export function observeRuntime(root, originalPaths, queryRpms) {
  const fs = process.getBuiltinModule('node:fs')
  const path = process.getBuiltinModule('node:path')
  const { createHash } = process.getBuiltinModule('node:crypto')
  const hash = file =>
    createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  const files = Object.fromEntries(
    originalPaths.map(file => [file, hash(file)]),
  )
  const noticeRoot = path.join(root, 'third-party-notices')
  const notices = fs.existsSync(path.join(noticeRoot, 'index.json'))
    ? JSON.parse(fs.readFileSync(path.join(noticeRoot, 'index.json')))
    : null
  const supplementalFiles = {}
  const directNoticeFiles = {}
  const packages = []
  function visit(directory) {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.bin') continue
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink())
        throw new Error('Unreviewed runtime package symlink')
      if (entry.isDirectory()) visit(file)
      else if (
        entry.name === 'package.json' &&
        /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(file)
      ) {
        const item = JSON.parse(fs.readFileSync(file))
        packages.push({
          name: item.name,
          version: item.version,
          sourcePath: path.relative(root, path.dirname(file)),
        })
      }
    }
  }
  visit(path.join(root, 'node_modules'))
  const identities = entries =>
    entries
      .map(({ name, version, sourcePath }) =>
        JSON.stringify({ name, version, sourcePath }),
      )
      .sort()
      .join('\n')
  if (identities(packages) !== identities(notices?.packages ?? [])) {
    throw new Error('Installed npm inventory differs from notice index')
  }
  for (const entry of notices?.packages ?? []) {
    for (const file of entry.notices) {
      const relative = path.join(entry.sourcePath, file)
      directNoticeFiles[relative] = hash(path.join(noticeRoot, relative))
    }
    for (const notice of entry.supplemental?.notices ?? []) {
      supplementalFiles[notice.path] = hash(
        path.join(noticeRoot, 'supplemental', notice.path),
      )
    }
  }
  return {
    files,
    notices,
    supplementalFiles,
    directNoticeFiles,
    rpms: queryRpms(),
  }
}

export function sourceRpmEntries(layerDigest, listing) {
  return listing
    .split('\n')
    .filter(name => name.startsWith('./rpm_dir/') && name.endsWith('.src.rpm'))
    .map(name => {
      if (!/^\.\/rpm_dir\/[a-zA-Z0-9_+.:~-]+\.src\.rpm$/.test(name)) {
        throw new Error('Invalid source RPM member path')
      }
      return [name.slice('./rpm_dir/'.length), layerDigest]
    })
}

export function sourceRpmMap(layers) {
  const result = {}
  for (const { digest, listing } of layers) {
    for (const [rpm, layer] of sourceRpmEntries(digest, listing)) {
      if (Object.hasOwn(result, rpm))
        throw new Error(`Duplicate source RPM member: ${rpm}`)
      result[rpm] = layer
    }
  }
  return result
}

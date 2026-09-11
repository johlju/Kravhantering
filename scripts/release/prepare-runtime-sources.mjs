// Release orchestration: original source retrieval, candidate probes and archives.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  nativeSourceInputs,
  observeRuntime,
  releaseCandidates,
  sha256,
  sourceRpmMap,
  verifyRuntimeSource,
  verifySourceBase,
} from './runtime-source-contract.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const [metadataPath, outputPath] = process.argv.slice(2)
if (!metadataPath || !outputPath) {
  throw new Error(
    'Usage: prepare-runtime-sources.mjs <release-metadata.json> <output-directory>',
  )
}
const output = path.resolve(outputPath)
fs.mkdirSync(output, { recursive: true })
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
const run = (command, args) =>
  execFileSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const metadata = readJson(metadataPath)
const candidates = releaseCandidates(metadata)
const manifest = readJson(
  path.join(root, 'containers/node/npm-notices/manifest.json'),
)
const lock = readJson(
  path.join(root, 'containers/node/runtime-source.lock.json'),
)
verifySourceBase(
  lock,
  readJson(path.join(root, '.github/dependency-maintenance.json')),
)
const work = fs.mkdtempSync(path.join(output, '.sources-'))
const native = path.join(work, 'native')
const ubi = path.join(work, 'ubi')
fs.mkdirSync(native)
fs.mkdirSync(path.join(ubi, 'blobs/sha256'), { recursive: true })

function download(url, target, expected) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  run('curl', [
    '--fail',
    '--silent',
    '--show-error',
    '--location',
    '--retry',
    '3',
    '--proto',
    '=https',
    '--proto-redir',
    '=https',
    '--output',
    target,
    url,
  ])
  if (sha256(fs.readFileSync(target)) !== expected) {
    throw new Error(`Original source checksum mismatch: ${url}`)
  }
}

const inputs = nativeSourceInputs(manifest)
for (const input of inputs) {
  download(input.sourceUrl, path.join(native, input.path), input.sha256)
}
writeJson(path.join(native, 'SOURCE-INPUTS.json'), inputs)
writeJson(path.join(native, 'NOTICE-MANIFEST.json'), manifest)
fs.copyFileSync(
  path.join(root, 'containers/node/npm-notices/native/README.txt'),
  path.join(native, 'README.txt'),
)

const manifestHash = lock.manifestDigest.replace('sha256:', '')
const sourceManifestPath = path.join(ubi, 'blobs/sha256', manifestHash)
const registry = `https://${lock.repository.replace('/', '/v2/')}`
download(
  `${registry}/manifests/${lock.manifestDigest}`,
  sourceManifestPath,
  manifestHash,
)
const sourceManifest = readJson(sourceManifestPath)
const blobs = [sourceManifest.config, ...sourceManifest.layers]
for (const blob of blobs) {
  const target = path.join(
    ubi,
    'blobs/sha256',
    blob.digest.replace('sha256:', ''),
  )
  download(
    `${registry}/blobs/${blob.digest}`,
    target,
    blob.digest.replace('sha256:', ''),
  )
  if (fs.statSync(target).size !== blob.size)
    throw new Error('Source blob size mismatch')
}
// Derive correspondence from the verified source bytes, not a second inventory.
const sourceRpms = sourceRpmMap(
  sourceManifest.layers.map(layer => ({
    digest: layer.digest,
    listing: run('tar', [
      '-tzf',
      path.join(ubi, 'blobs/sha256', layer.digest.replace('sha256:', '')),
    ]),
  })),
)
writeJson(path.join(ubi, 'oci-layout'), { imageLayoutVersion: '1.0.0' })
writeJson(path.join(ubi, 'index.json'), {
  schemaVersion: 2,
  manifests: [
    {
      mediaType: sourceManifest.mediaType,
      digest: lock.manifestDigest,
      size: fs.statSync(sourceManifestPath).size,
    },
  ],
})
writeJson(path.join(ubi, 'SOURCE-LOCK.json'), lock)

const noticeLock = readJson(
  path.join(root, 'containers/node/runtime-notices.lock.json'),
)
const files = {
  ...Object.fromEntries(
    Object.values(noticeLock).map(({ installedPath, sha256 }) => [
      installedPath,
      sha256,
    ]),
  ),
  '/usr/share/licenses/kravhantering/LICENSE': sha256(
    fs.readFileSync(path.join(root, 'LICENSE')),
  ),
}
const probe = `
const { execFileSync } = require('node:child_process');
const queryRpms = () => execFileSync('rpm', ['-qa', '--qf', '%{NAME}\\t%{EPOCHNUM}\\t%{VERSION}\\t%{RELEASE}\\t%{ARCH}\\t%{SOURCERPM}\\t%{LICENSE}\\n'], { encoding: 'utf8' });
process.stdout.write(JSON.stringify((${observeRuntime.toString()})(process.cwd(), ${JSON.stringify(Object.keys(files))}, queryRpms)));
`

const observations = []
const serviceUser = process.env.PRODUCTION_SMOKE_SERVICE_USER ?? 'kravhantering'
const serviceUid = run('id', ['-u', serviceUser]).trim()
for (const candidate of candidates) {
  // The production smoke imports these exact archives. Address their locked image
  // IDs directly so a mutable tag cannot change the source/license observation.
  const observation = JSON.parse(
    run('sudo', [
      '-H',
      '-u',
      serviceUser,
      'env',
      '-u',
      'XDG_CACHE_HOME',
      '-u',
      'XDG_CONFIG_HOME',
      '-u',
      'XDG_DATA_HOME',
      '-u',
      'CONTAINERS_CONF',
      '-u',
      'CONTAINERS_REGISTRIES_CONF',
      '-u',
      'CONTAINERS_STORAGE_CONF',
      '-u',
      'REGISTRY_AUTH_FILE',
      `XDG_RUNTIME_DIR=/run/user/${serviceUid}`,
      `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${serviceUid}/bus`,
      'podman',
      'run',
      '--rm',
      '--pull=never',
      '--network=none',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--entrypoint=node',
      candidate.imageId,
      '-e',
      probe,
    ]),
  )
  observation.imageId = candidate.imageId
  observations.push(
    verifyRuntimeSource({
      observation,
      candidate,
      lock: { ...lock, sourceRpms },
      manifest,
      files,
    }),
  )
}

const archives = []
for (const [name, directory] of [
  ['native-library-sources.tar', native],
  ['ubi-runtime-sources.oci.tar', ubi],
]) {
  const target = path.join(output, name)
  run('tar', [
    '--sort=name',
    '--mtime=@0',
    '--owner=0',
    '--group=0',
    '--numeric-owner',
    '-cf',
    target,
    '-C',
    directory,
    '.',
  ])
  archives.push({
    name,
    sha256: run('sha256sum', [target]).split(' ')[0],
    size: fs.statSync(target).size,
  })
}
writeJson(path.join(output, 'runtime-source-evidence.json'), {
  schemaVersion: 1,
  commitSha: metadata.commitSha,
  version: metadata.version,
  observedAt: new Date().toISOString(),
  sourceManifest: lock.manifestDigest,
  sourceRpms,
  archives,
  candidates: observations,
  nativeInputs: inputs,
  qualification:
    'Original source superset and notices; no exact binary reproducibility, future upstream availability or platform certification claim. Source transfer bytes are separate from runtime image transfer.',
})
fs.rmSync(work, { recursive: true })

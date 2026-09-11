const LOCK_SCHEMA_VERSION = 2
const SELECTION_FIELDS = [
  'baseImage',
  'baseTag',
  'baseDigest',
  'nodeVersion',
  'opensslPackageVersion',
  'caCertificatesPackageVersion',
]

function mismatch(message) {
  throw new Error(`HSA provisioner toolchain lock mismatch: ${message}`)
}

/**
 * Verify both the selected build inputs and versions observed inside the image
 * against the committed toolchain lock.
 *
 * @param {{
 *   lock: Record<string, unknown>,
 *   observed: {
 *     packages: Record<string, string>[],
 *     caCertificatesPackageVersion: string,
 *     nodeVersion: string,
 *     opensslPackageVersion: string,
 *     opensslVersion: string,
 *   },
 *   selection: Record<string, string>,
 * }} input
 * @returns {void}
 */
export function verifyToolchainLock({ lock, observed, selection }) {
  if (lock.schemaVersion !== LOCK_SCHEMA_VERSION) {
    mismatch('unsupported schema version')
  }
  for (const field of SELECTION_FIELDS) {
    if (typeof lock[field] !== 'string' || lock[field].length === 0) {
      mismatch(`lock field ${field} is invalid`)
    }
    if (selection[field] !== lock[field]) {
      mismatch(`selected ${field} differs from the lock`)
    }
  }
  if (typeof lock.opensslVersion !== 'string' || !lock.opensslVersion) {
    mismatch('lock field opensslVersion is invalid')
  }

  if (
    typeof lock.installedNodeVersion !== 'string' ||
    !/^24\.\d+\.\d+$/u.test(lock.installedNodeVersion)
  ) {
    mismatch('lock field installedNodeVersion is invalid')
  }

  const observedNodeMajor = /^(\d+)(?:\.|$)/u.exec(observed.nodeVersion)?.[1]
  if (observedNodeMajor !== lock.nodeVersion) {
    mismatch('installed Node major differs from the lock')
  }
  if (observed.nodeVersion !== lock.installedNodeVersion) {
    mismatch('installed Node version differs from the lock')
  }
  verifyPackages(lock, observed.packages)
  if (observed.opensslPackageVersion !== lock.opensslPackageVersion) {
    mismatch('installed OpenSSL package differs from the lock')
  }
  if (observed.opensslVersion !== lock.opensslVersion) {
    mismatch('installed OpenSSL binary differs from the lock')
  }
  if (
    observed.caCertificatesPackageVersion !== lock.caCertificatesPackageVersion
  ) {
    mismatch('installed CA certificates package differs from the lock')
  }
}

function verifyPackages(lock, observed) {
  const names = ['openssl', 'openssl-libs', 'ca-certificates']
  const fields = [
    'name',
    'epoch',
    'version',
    'architecture',
    'sourceRpm',
    'vendor',
  ]
  if (!Array.isArray(lock.packages) || lock.packages.length !== names.length) {
    mismatch('lock RPM package records are invalid')
  }
  if (!Array.isArray(observed) || observed.length !== names.length) {
    mismatch('installed RPM package evidence is missing or ambiguous')
  }
  for (const name of names) {
    const expected = lock.packages.filter(entry => entry?.name === name)
    if (expected.length !== 1) mismatch('lock RPM package identity is invalid')
    const actual = observed.filter(entry => entry?.name === name)
    if (actual.length !== 1)
      mismatch(`installed RPM ${name} identity differs from the lock`)
    for (const field of fields) {
      if (typeof expected[0][field] !== 'string' || !expected[0][field]) {
        mismatch(`lock RPM ${name} ${field} is invalid`)
      }
      if (actual[0][field] !== expected[0][field]) {
        mismatch(`installed RPM ${name} ${field} differs from the lock`)
      }
    }
    const selectedVersion =
      name === 'ca-certificates'
        ? lock.caCertificatesPackageVersion
        : lock.opensslPackageVersion
    if (expected[0].version !== selectedVersion) {
      mismatch(`lock RPM ${name} version differs from selected package version`)
    }
  }
}

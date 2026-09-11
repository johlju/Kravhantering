# Shared UBI runtime packaging

`ubi-compat.sh` owns the filesystem adaptation used by all six published Node
runtime images. Each consumer mounts this directory during its build; workload
packages, commands and final users remain declared by that workload.

The helper downloads the unmodified
[Red Hat Universal Base Image EULA](https://www.redhat.com/licenses/EULA_Red_Hat_Universal_Base_Image_English_20190422.pdf)
during each uncached runtime build and verifies its SHA-256 against
`runtime-notices.lock.json` before installing it as
`/usr/share/licenses/ubi/UBI-EULA.pdf`, readable by all supported runtime users.
The PDF remains in its original format; builds do not extract its text or
store a copy in Git. It supplements inherited component notices and the
project's MIT license.

The existing release build needs HTTPS access to the locked notice URLs. A
failed download or checksum mismatch fails that build. Exact candidate
verification compares installed notices with the same lock. Using UBI does
not imply Red Hat endorsement, certification, or support for Kravhantering.

Final workload Dockerfiles label their images as Viscalyx/Kravhantering and
describe the actual runtime. They clear inherited base-image build/version
identity and obsolete S2I hints; release commands supply the authoritative OCI
revision and version. OS/package provenance and the vendor license URL remain
available separately. These identity labels do not claim certification.

## Project and dependency notices

All six images retain the repository's original MIT `LICENSE` at
`/usr/share/licenses/kravhantering/LICENSE` through the shared packaging step.

The application standalone trace and the database/HSA dependency stages run
`scripts/containers/copy-runtime-notices.mjs`. It selects package roots actually
shipped by that stage and copies original license, notice and copyright files,
including bundled notices below those roots, into `third-party-notices`.
The directory is copied with the workload into its runtime image. Executable
launcher links are not package identities. Ambiguous symbolic links, package
identity mismatches and missing authoritative notices fail packaging.

`npm-notices/manifest.json` binds supplemental upstream notices to exact
package names and versions, source revisions/URLs and content checksums.
The packager verifies each supplemental checksum and retains that complete
record in its output index. Files that contain source or Markdown are stored
as text with their original paths recorded, so repository formatting cannot
change their authoritative bytes. Unresolved entries fail packaging; package
license identifiers and README declarations are evidence, not substitutes for
missing permission or attribution text.

Review the supplemental source record whenever a dependency version changes.
Preserve original notices rather than copying an unrelated current release's
license. This requirement also applies to bundled third-party components.
The retained evidence records gaps found in both Debian and UBI candidates;
notice preservation is not evidence of a UBI-only regression or blanket legal
compliance. The application image also carries a readable native library-use,
acknowledgement, source-access and replacement handoff at
`third-party-notices/supplemental/native/README.txt`.

The inherited `nodejs-nodemon` RPM includes its bundled dependency notices but
omits nodemon's top-level license from installation. The shared helper restores
that original MIT notice at `/usr/share/licenses/nodejs-nodemon/LICENSE` by
fetching its immutable upstream revision and verifying the checksum in
`runtime-notices.lock.json`. The downloaded bytes match the original license
in the source RPM; no license payload is stored in Git.
`nodejs-nodemon-notice.json` records the corresponding public source-image
layer, source RPM, bundled archive and original path. Review that source
correspondence and the notice lock with runtime-base updates. Nodemon remains
installed.

## Release source delivery

The release workflow verifies the original PDF and notices against all six
exact candidate image IDs and publishes corresponding native and UBI source
archives. `runtime-source.lock.json` identifies the original public UBI source
manifest. The workflow derives RPM correspondence from its original layers.
Refresh the source manifest with runtime-base updates; installed RPMs without
matching source fail publication. Native recipe and patch records identify original download URLs and hashes.
The release retrieves and verifies those inputs into temporary storage, then
includes them with the published source archives. Downloaded third-party
material is not stored in Git.
See [Trusted Container Publishing](../../docs/development/trusted-container-publishing.md#runtime-sources-and-original-notices)
for the release evidence and retention contract.

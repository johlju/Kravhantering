# Shared UBI runtime packaging

`ubi-compat.sh` owns the filesystem adaptation used by all six published Node
runtime images. Each consumer mounts this directory during its build; workload
packages, commands and final users remain declared by that workload.

`UBI-EULA.pdf` is the unmodified
[Red Hat Universal Base Image EULA](https://www.redhat.com/licenses/EULA_Red_Hat_Universal_Base_Image_English_20190422.pdf),
retrieved on 2026-09-11. Its SHA-256 is
`a07025b9f5b71a816febe6ac76f21c9f759c806fa0a66874af90a50c3293f1b6`.
The helper installs it as `/usr/share/licenses/ubi/UBI-EULA.pdf`, readable by
all supported runtime users. It supplements the inherited component notices;
it does not replace their licenses or the project's MIT license. Keep this
vendor document unmodified when updating the shared packaging.

Builds use the committed document and need no documentation-site download.
Exact candidate verification compares the installed document's checksum with
this recorded upstream checksum. Using UBI does not imply Red Hat endorsement,
certification, or support for Kravhantering.

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
that original MIT notice at `/usr/share/licenses/nodejs-nodemon/LICENSE`.
`nodejs-nodemon-notice.json` records the exact public source-image layer, source
RPM, bundled archive, original path and checksums used to recover it. Review
that source correspondence with runtime-base updates. Nodemon remains installed.

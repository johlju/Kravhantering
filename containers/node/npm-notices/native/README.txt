Kravhantering third-party software notices

Paths below are relative to the runtime third-party-notices directory.

Kravhantering is distributed by Viscalyx. Its project MIT license is installed
at /usr/share/licenses/kravhantering/LICENSE. Component licenses govern their
respective software; this notice does not replace those terms.

Each runtime's third-party-notices/index.json identifies its shipped npm
packages, the original dependency notice paths, and exact supplemental source
records and SHA-256 checksums. Original notices remain unmodified. Canonical
MIT/ISC texts are labeled separately from actual package declarations and
attributions; their example names/placeholders are not package copyright
facts. The hsl-to-hex 1.0.0 metadata says MIT while its README says ISC. Both
original declarations and both standard texts are retained; this inventory
does not choose between them or assert a dual-license grant.

Native image-processing library use

Application image processing uses libvips and the LGPL-licensed libraries
combined into @img/sharp-libvips-linux-x64 1.3.3. Applicable library components
are conveyed under GNU LGPL version 3 through their upstream later-version
permissions, together with their other applicable component terms. Complete
GNU LGPL version 3 and GNU GPL version 3 texts are in
supplemental/native/LGPL-3.0.txt and supplemental/native/GPL-3.0.txt.

This product includes the FreeType font engine, developed by the FreeType
Project (https://freetype.org). Its original credits and FreeType Project
License are in supplemental/native/components/freetype/.

This software is based in part on the work of the Independent JPEG Group.
The original JPEG notices are in supplemental/native/components/mozjpeg/.

Library modification and replacement

Recipients retain the component licenses' rights to modify the libraries and
to reverse engineer the combined work for debugging those modifications.
No Kravhantering license term removes these rights. The Linux application
loads /app/node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.6
from its native Sharp addon using a relative library search path. A recipient
can build a derived image replacing that file with a modified library that
preserves the required interface and SONAME. Immutable release identity does
not prohibit creation of such a modified image. An alternative binary has
not been tested by this notice collection.

Source access

The supplemental native package record in index.json identifies separate
component source archives, exact recipe and patch records, public source URLs
and observed checksums under sourceEvidence. These are the uncombined source
forms for the statically combined native library, with its modifications and
build scripts identified separately. The recipe is available at:
https://github.com/lovell/sharp-libvips/tree/6e5971d333377743163edc3ad9e5d0b897abcbc9

The matching Kravhantering GitHub Release provides native-library-sources.tar,
ubi-runtime-sources.oci.tar, runtime-source-evidence.json and
runtime-sources.sha256 alongside binary downloads:
https://github.com/viscalyx/Kravhantering/releases
Select the release identified by the image's version and revision labels.
The source evidence binds the archives to that run's six image manifest
identities. The native archive includes original component and registry-crate
archives, build recipes, patches and their hash-locked source records. The UBI
archive retains the original source-image manifest and all source RPM layers.
Both archives are separately downloadable at no charge. Retain these source
assets with the binary release when mirroring or redistributing it, including
the separately transferred source collection for disconnected recipients.
Runtime installation does not download build sources or tools. See the release
artifact verification guide for authenticated archive verification.

The native source/notice collection conservatively includes auxiliary,
build, test and other-platform code. Its 359-package Rust source lock is a
superset, not an exact inventory of the linked Linux binary. Moving build
tools and the recorded pull-request patch URL limit reconstruction of the
original environment. No exact binary reproducibility or platform
certification is claimed.

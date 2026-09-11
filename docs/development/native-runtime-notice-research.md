# Native runtime notices and source access

This report covers `@img/sharp-libvips-linux-x64@1.3.3`, consumed by
`sharp@0.35.4`. Its public npm metadata identifies packaging commit
`6e5971d333377743163edc3ad9e5d0b897abcbc9`. The recovered evidence supports
notice packaging and a source-access handoff; it does not constitute blanket
legal clearance or a claim that an alternative build is byte-identical.
[Package metadata](https://registry.npmjs.org/@img%2fsharp-libvips-linux-x64/1.3.3)

## Exact inputs and recovered material

The package's installed `versions.json` matches all 28 entries in the
[version record at the published commit](https://github.com/lovell/sharp-libvips/blob/6e5971d333377743163edc3ad9e5d0b897abcbc9/versions.properties).
The associated
[Linux build recipe](https://github.com/lovell/sharp-libvips/blob/6e5971d333377743163edc3ad9e5d0b897abcbc9/build/posix.sh)
identifies the source URLs, patches, configuration changes and static linking
steps. The evidence collection contains all 28 versioned source downloads,
the recipe archive, and all four external patches, with SHA-256 hashes.
All downloads succeed anonymously on 2026-09-11. Their availability now is not
a guarantee of future upstream hosting.

The upstream
[third-party notice table](https://github.com/lovell/sharp-libvips/blob/6e5971d333377743163edc3ad9e5d0b897abcbc9/THIRD-PARTY-NOTICES.md)
is a multi-platform declaration, not a substitute for complete terms. The
recipe excludes its internationalization stub from glibc Linux. The GIF
library is embedded inside the exact libvips source archive; its original MIT
notice is retained. GLib's embedded database helper notices are retained too.

The SVG library's source archive contains a Cargo lock with 359 packages.
Three workspace packages reside in that archive. All 356 registry source
archives are recovered and their SHA-256 hashes match the upstream lock.
This is a conservative **source superset**, including development and other
platform dependencies, not an assertion that every crate is linked into the
Linux binary. The recipe's `cargo update --workspace` does not imply arbitrary
updates of already locked external dependencies: Cargo documents that these
remain locked unless absent from the lockfile.
[Cargo update semantics](https://doc.rust-lang.org/cargo/commands/cargo-update.html)

The evidence directory
`/tmp/batch-1329-evidence/supplemental-native-notices` contains:

- `manifest.json`: exact npm identity, 751 notice entries, original source URLs,
  file hashes, component versions and explicit scope qualifications.
- `sources/`: versioned native archives and checksum-verified crate archives.
- `component-sources.json`, `rust-sources.json` and `additional-sources.json`:
  source records, archive paths, recipe and patch provenance.
- `addon-elf-dynamic.txt` and `libvips-elf-dynamic.txt`: observed linking metadata.

Every notice entry's hash is checked against its stored bytes. Source archives
stay separate from runtime notice files. Eight crates without standalone terms
retain their original package declarations and author metadata, supplemented
with clearly identified canonical license texts; no copyright is invented.
The runtime CSS selector crate also retains its original MPL source notice.
An omitted standalone file does not itself establish absence of a license
grant. The source-superset scope remains explicit in each relevant record.

## Applicable distribution obligations

The packaging project declares LGPL version 3 for applicable libraries through
upstream later-version permissions. Its Apache license applies to the packaging
scripts and must not replace the native library terms. Convey the original
component notices and complete GNU GPL version 3 and LGPL version 3 texts with
the binary. LGPL section 4 also requires notice of library use and terms that
preserve library modification and reverse engineering for debugging changes.
[Published licensing selection](https://github.com/lovell/sharp-libvips/blob/6e5971d333377743163edc3ad9e5d0b897abcbc9/THIRD-PARTY-NOTICES.md),
[GNU LGPL version 3](https://www.gnu.org/licenses/lgpl-3.0.html)

The observed native addon names `libvips-cpp.so.8.18.6` in `DT_NEEDED` and uses
relative library search paths into the npm package. Recipients can derive an
image containing a modified, interface-compatible library at that location.
This provides concrete support for the shared-library route in LGPL section
4(d)(1); it is not a claim that an alternative library is tested. Preserve this
replacement ability and document the path. An immutable published image does
not prevent recipients from producing their own modified image.
[Shared-library route](https://www.gnu.org/licenses/lgpl-3.0.html#section4)

That route does not erase obligations for the library binary itself. The
recipe statically combines component libraries into the shared object.
Corresponding-source access must include their sources, relevant modifications
and build scripts. LGPL section 5 addresses combined libraries and requires
an accompanying uncombined form and notice explaining its location. The
collected component source archives and separate patches provide material for
that handoff; the release should identify these uncombined source forms.
[GNU LGPL sections 4 and 5](https://www.gnu.org/licenses/lgpl-3.0.html),
[GNU GPL corresponding source and conveyance](https://www.gnu.org/licenses/gpl-3.0.html#section6)

For a network distribution route under GPL section 6(d), give clear directions
alongside the binary to equivalent source access. A different server, including
a third party, is permitted, but the distributor remains responsible for
availability. Hosting the captured source collection with the release makes
that obligation easier to maintain. Disconnected recipients should receive
clear source-access directions or a separately supplied source archive; the
runtime image itself need not contain build tools or source downloads.
[GNU GPL section 6(d)](https://www.gnu.org/licenses/gpl-3.0.html#section6)

Preserve the other component terms too, including patent notices and source
availability under the selected Mozilla license. Product documentation should
credit the FreeType font engine and include the JPEG project's required
acknowledgement: “This software is based in part on the work of the Independent
JPEG Group.” Preserve upstream copyright statements as supplied rather than
filling in guessed years or authors.
[FreeType licensing choice](https://github.com/freetype/freetype/blob/VER-2-14-3/LICENSE.TXT),
[JPEG licensing and acknowledgement](https://github.com/mozilla/mozjpeg/blob/0826579/LICENSE.md),
[Mozilla Public License version 2](https://www.mozilla.org/en-US/MPL/2.0/)

## Remaining release handoff and limits

The concrete remaining actions are to attach the recovered notices, supply
prominent library-use and acknowledgement text, and publish clear source-access
and compatible-library replacement instructions. Source access is observed;
publication of those materials is not performed by this research task.

No required top-level or lock-selected registry source download is unavailable
in this collection. The package does not provide its final Linux Rust dependency
graph, so the source superset must retain that qualification. Moving builder
and tool versions, and the recipe's pull-request patch URL, limit reconstruction
of the original build environment; they do not by themselves prohibit
redistribution or create a new reproducible-build certification requirement.
The patch bytes and current upstream commit metadata are retained. Review the
chosen distribution route and source directions together with the final
candidate notices before publication.

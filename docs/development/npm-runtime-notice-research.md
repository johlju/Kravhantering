# Runtime npm notice research

This report records exact package notice recovery for issue #1338. It covers
24 npm packages in the candidate inventory; native libvips evidence is separate.
It does not establish blanket redistribution clearance.

## Evidence and binding

The supplemental manifest binds each package name and version to its npm
tarball URL and SHA-512 integrity. Every downloaded tarball matches that
integrity. Notice files preserve upstream bytes and have SHA-256 hashes.
The evidence directory also retains published packages, source trees and npm
provenance payloads where available. The provenance payload supplies a source
binding; this investigation does not independently verify its signature.

For packages with a published `gitHead`, notices use that exact revision.
Additional bindings use immutable source commits resolved from release tags,
npm provenance, or explicit upstream publication metadata. Package versions
and source scope are checked rather than inferred from the current branch.

The recoverable set contains 17 package notice sets. Seven records retain
explicit unresolved findings. A README or package metadata license identifier
is declaration evidence; it is not represented as a recovered full license.

## Recovered package notices

Each package link identifies its published npm version. Each notice link
identifies the original bytes at an immutable source revision.

<!-- markdownlint-disable MD013 -->
| Package | Original notice | Source binding |
| --- | --- | --- |
| [abs-svg-path 0.1.1](https://registry.npmjs.org/abs-svg-path/0.1.1) | [Original](https://raw.githubusercontent.com/jkroso/abs-svg-path/f0f57c97b12cdc4fc1d94798256fba357394e40a/License) | Release tag 0.1.1; source package.json and index.js match shipped version |
| [typeorm 1.1.1](https://registry.npmjs.org/typeorm/1.1.1) | [Original](https://raw.githubusercontent.com/typeorm/typeorm/3ecf2c8dfccd02dd77f593fd7aa478c25ea9d428/LICENSE) | npm provenance resolvedDependencies gitCommit |
| [yoga-layout 3.2.1](https://registry.npmjs.org/yoga-layout/3.2.1) | [Original](https://raw.githubusercontent.com/facebook/yoga/042f5013152eb81c1552dec945b88f7b95ca350f/LICENSE) | Release tag v3.2.1; javascript/package.json version 3.2.1 |
| [@next/env 16.3.4](https://registry.npmjs.org/@next%2Fenv/16.3.4) | [Original](https://raw.githubusercontent.com/vercel/next.js/299180d3315c7ebd7b199d2b1a265b5986c5fc7d/license.md) | npm provenance resolvedDependencies gitCommit |
| [@react-pdf/image 3.1.2](https://registry.npmjs.org/@react-pdf%2Fimage/3.1.2) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/d5adf3db48fff165c433aaf5ba54600542700cff/LICENSE) | npm published gitHead |
| [@react-pdf/fns 3.1.3](https://registry.npmjs.org/@react-pdf%2Ffns/3.1.3) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/a8301b239f750ee2a74e851522daadc3718b30e3/LICENSE) | npm published gitHead |
| [@react-pdf/renderer 4.9.0](https://registry.npmjs.org/@react-pdf%2Frenderer/4.9.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/2c0b6d4a5d9db397d8cf5de4215e43b08ad5a7ca/LICENSE) | npm published gitHead |
| [@react-pdf/paginate 1.0.1](https://registry.npmjs.org/@react-pdf%2Fpaginate/1.0.1) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/1fe630e22c1172b1f61f782cd4c65fbf81393218/LICENSE) | npm published gitHead |
| [@react-pdf/svg 1.1.1](https://registry.npmjs.org/@react-pdf%2Fsvg/1.1.1) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/d5adf3db48fff165c433aaf5ba54600542700cff/LICENSE) | npm published gitHead |
| [@react-pdf/hyphenate 0.1.0](https://registry.npmjs.org/@react-pdf%2Fhyphenate/0.1.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/55da3fb6c7cc467ba502744cc70566c50508b597/LICENSE) | Authoritative manual-publication commit; packages/hyphenate/package.json version 0.1.0 |
| [@react-pdf/render 4.7.0](https://registry.npmjs.org/@react-pdf%2Frender/4.7.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/2c0b6d4a5d9db397d8cf5de4215e43b08ad5a7ca/LICENSE) | npm published gitHead |
| [@react-pdf/reconciler 2.0.0](https://registry.npmjs.org/@react-pdf%2Freconciler/2.0.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/52e97fd0052f4e634d8b39143154e0a09ff98cba/LICENSE) | npm published gitHead |
| [@react-pdf/stylesheet 6.3.2](https://registry.npmjs.org/@react-pdf%2Fstylesheet/6.3.2) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/2c0b6d4a5d9db397d8cf5de4215e43b08ad5a7ca/LICENSE) | npm published gitHead |
| [@react-pdf/primitives 4.4.0](https://registry.npmjs.org/@react-pdf%2Fprimitives/4.4.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/d5adf3db48fff165c433aaf5ba54600542700cff/LICENSE) | npm published gitHead |
| [@react-pdf/textkit 7.0.1](https://registry.npmjs.org/@react-pdf%2Ftextkit/7.0.1) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/8c047bd26d3d0a46eee0238659100f68a7a7b881/LICENSE) | npm published gitHead |
| [@react-pdf/font 4.1.2](https://registry.npmjs.org/@react-pdf%2Ffont/4.1.2) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/2c0b6d4a5d9db397d8cf5de4215e43b08ad5a7ca/LICENSE) | npm published gitHead |
| [@react-pdf/layout 5.2.0](https://registry.npmjs.org/@react-pdf%2Flayout/5.2.0) | [Original](https://raw.githubusercontent.com/diegomura/react-pdf/2c0b6d4a5d9db397d8cf5de4215e43b08ad5a7ca/LICENSE) | npm published gitHead |
<!-- markdownlint-enable MD013 -->

The `abs-svg-path` source package version is `0.1.1`, and its `index.js` is
byte-identical to the published file. Yoga’s tagged source declares `3.2.1`
in its JavaScript package. The hyphenation package has an explicit upstream
commit explaining the manual first publication and setting version `0.1.0`.
Sources:
[abs-svg-path package](https://github.com/jkroso/abs-svg-path/blob/f0f57c97b12cdc4fc1d94798256fba357394e40a/package.json),
[Yoga package](https://github.com/facebook/yoga/blob/042f5013152eb81c1552dec945b88f7b95ca350f/javascript/package.json),
[hyphenation publication commit](https://github.com/diegomura/react-pdf/commit/55da3fb6c7cc467ba502744cc70566c50508b597).

## Additional bundled notices

`@react-pdf/reconciler` includes three generated reconciler implementations.
Its exact source declares React reconciler versions `0.23.0`,
`0.31.0-rc-603e6108-20241029` and `0.33.0`. The supplemental set retains the
original `LICENSE` from each exact published React package alongside the
React-PDF repository license.
[Source dependencies](https://github.com/diegomura/react-pdf/blob/52e97fd0052f4e634d8b39143154e0a09ff98cba/packages/reconciler/package.json).

Brotli’s decoder files carry Google copyright notices and Apache 2.0 terms,
although the package metadata and README say MIT. The supplemental set
preserves the seven original decoder source files containing these headers
and the Apache 2.0 license they reference. The exact source also pins its
Brotli C++ vendor through a Git submodule; that revision’s original MIT
license is included separately. These recovered component notices do not
supply the missing general JavaScript wrapper notice.
[Decoder source](https://github.com/foliojs/brotli.js/blob/e36051345f6d27a56e5f39ea70d2f789b8574046/dec/decode.js),
[vendor binding](https://github.com/foliojs/brotli.js/tree/e36051345f6d27a56e5f39ea70d2f789b8574046/vendor),
[vendor license](https://github.com/google/brotli/blob/5ce9bf11b3fe0924d87b2a2d47eb7a53a76a4421/LICENSE),
[Apache license](https://www.apache.org/licenses/LICENSE-2.0.txt).

Yoga’s recovered repository license applies to its JavaScript and native
Yoga code. The separate `LICENSE-examples` governs example code and is not
substituted for the runtime license. The published JavaScript source retains
Meta copyright headers.
[JavaScript source](https://github.com/facebook/yoga/blob/042f5013152eb81c1552dec945b88f7b95ca350f/javascript/src/index.ts),
[example license](https://github.com/facebook/yoga/blob/042f5013152eb81c1552dec945b88f7b95ca350f/LICENSE-examples).

## Unresolved upstream findings

An absent standalone license file does not establish absent licensing or a
redistribution prohibition. npm documents the `license` field as the author’s
statement of permitted use and recommends SPDX identifiers. SPDX supplies
canonical identifiers and their standard texts. A clearly attributed copy
of standard terms is distinct from a recovered upstream notice; it cannot
create an absent copyright attribution or resolve contradictory declarations.
[npm package metadata documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#license),
[SPDX license list](https://spdx.org/licenses/).

These findings distinguish unavailable original text from contradictory
license declarations. No author name is converted into an invented copyright
notice, and no generic license is substituted for an absent upstream file.

### dfa 1.2.0

Published package and exact-source README specify MIT but no full general
license or copyright notice is present. Third-party component notices do not
supply the missing general notice.

[Published metadata](https://registry.npmjs.org/dfa/1.2.0),
[exact published archive](https://registry.npmjs.org/dfa/-/dfa-1.2.0.tgz),
[exact source tree](https://github.com/devongovett/dfa/tree/3f5e603e5082caedabefefdf53e8a6ca3111e966).

### hsl-to-hex 1.0.0

Published package metadata says MIT; published README says ISC. Source
repository has no full license. No authoritative resolution of contradictory
terms.

[Published metadata](https://registry.npmjs.org/hsl-to-hex/1.0.0),
[exact published archive](https://registry.npmjs.org/hsl-to-hex/-/hsl-to-hex-1.0.0.tgz).

The initial source manifest also declares MIT, while a subsequent source
manifest uses the scoped package name and ISC. Neither is a full license
notice or an authoritative reconciliation of the published contradiction.
[Initial source metadata](https://github.com/davidmarkclements/hsl-to-hex/blob/eed6409348a28bd89c30f67a724ebf6cf71f64d2/package.json),
[subsequent source metadata](https://github.com/davidmarkclements/hsl-to-hex/blob/b7603ef80832e3bf67060907d6f0b7b67cba4afe/package.json).

### media-engine 2.0.0

Exact-source README states MIT and names Diego Muracciole as copyright holder,
but full permission text is absent.

[Published metadata](https://registry.npmjs.org/media-engine/2.0.0),
[exact published archive](https://registry.npmjs.org/media-engine/-/media-engine-2.0.0.tgz),
[exact source tree](https://github.com/diegomura/media-engine/tree/491a0a6b8be9af2166a515af0bbc427a81f00930).

The copyright attribution is in the README’s final License section. Its
link to a conventional `LICENSE` has no corresponding file in this exact
tree. The unmodified README is retained as declaration evidence.
[README](https://github.com/diegomura/media-engine/blob/491a0a6b8be9af2166a515af0bbc427a81f00930/README.md).

### client-only 0.0.1

Published package has MIT identifier but no copyright notice, full license
text, repository or source revision. No attributable source notice recovered.

[Published metadata](https://registry.npmjs.org/client-only/0.0.1),
[exact published archive](https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz).

The archive contains only `package.json`, `index.js` and `error.js`. Its
homepage and issue link refer to React, but that is insufficient evidence
to assign an unrelated repository’s copyright notice to this publication.

### brotli 1.3.3

Published package and exact-source README specify MIT but no full general
license or copyright notice is present. Third-party component notices do not
supply the missing general notice.

[Published metadata](https://registry.npmjs.org/brotli/1.3.3),
[exact published archive](https://registry.npmjs.org/brotli/-/brotli-1.3.3.tgz),
[exact source tree](https://github.com/devongovett/brotli.js/tree/e36051345f6d27a56e5f39ea70d2f789b8574046).

### hsl-to-rgb-for-reals 1.1.1

Published package and exact source package.json specify ISC, but no full
permission or copyright notice is present in source or published files.

[Published metadata](https://registry.npmjs.org/hsl-to-rgb-for-reals/1.1.1),
[exact published archive](https://registry.npmjs.org/hsl-to-rgb-for-reals/-/hsl-to-rgb-for-reals-1.1.1.tgz),
[exact source tree](https://github.com/davidmarkclements/hsl_rgb_converter/tree/f5c494e4c8ddb31262326304690964379f1ed697).

### fontkit 2.0.4

Published package and exact-source README specify MIT but no full general
license or copyright notice is present. Third-party component notices do not
supply the missing general notice.

[Published metadata](https://registry.npmjs.org/fontkit/2.0.4),
[exact published archive](https://registry.npmjs.org/fontkit/-/fontkit-2.0.4.tgz),
[exact source tree](https://github.com/foliojs/fontkit/tree/fbf3b9ef21eebd219eb73e666faed573af0fba09).

The source tree contains licenses for test fonts. Those files govern the
test font assets and do not supply a general Fontkit notice.

## Scope of the remaining decision

Seven records lack a recovered full general upstream notice. Six have an
explicit license declaration without the conflicting identifier found in
`hsl-to-hex`. They are not classified as unlicensed packages. The concrete
MIT/ISC contradiction remains separate from missing notice text. Canonical
terms could be supplied with accurate provenance, while any uncertainty
about absent copyright attribution remains explicit. Their evidence is
retained without claiming clearance. The candidate and Debian baseline both
contain these packages; absence of their general notices is not established
as a UBI-specific regression. This report changes no package versions or
runtime behavior, and requires no manual UI cases.

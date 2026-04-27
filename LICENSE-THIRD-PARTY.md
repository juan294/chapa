# Third-Party Licenses

This project is licensed under the MIT License (see `LICENSE`). Most dependencies
use permissive licenses (MIT, Apache-2.0, BSD, ISC) that are fully compatible
with MIT.

The following currently installed dependencies use weak copyleft licenses and are
documented here for transparency.

## MPL-2.0 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@resvg/resvg-js` | ^2.6.2 | SVG-to-PNG rasterization for badge rendering |
| `lightningcss` | 1.32.0 | CSS transformation pipeline used by Tailwind / Next.js tooling |
| `dompurify` | 3.4.0 | Transitive dependency (dual-licensed `MPL-2.0 OR Apache-2.0`); used unmodified through its public API. We accept it under MPL-2.0 since the same reasoning applies; the Apache-2.0 alternative is also available. |

## LGPL-3.0-or-later Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@img/sharp-libvips-darwin-arm64` | 1.2.4 | Native `libvips` binary bundled behind `sharp` on darwin-arm64 installs |

## Why MPL-2.0 is Accepted

MPL-2.0 is a **file-level** copyleft license, not a project-level one like GPL.
Its obligations only apply when you **modify the MPL-licensed source files
themselves**. Using an MPL-2.0 library as a dependency (importing and calling its
API) does not trigger any copyleft requirements on our code.

Specifically:

1. **No modifications**: We use these packages as-is via their public APIs. We do
   not modify, fork, or redistribute their source files.
2. **Weak copyleft scope**: MPL-2.0 Section 1.10 defines "Covered Software" as
   only the original MPL-licensed files. Our MIT-licensed code remains MIT.
3. **Larger Work permitted**: MPL-2.0 Section 3.3 explicitly allows combining
   MPL-2.0 code with code under other licenses (including MIT) to form a "Larger
   Work" without requiring the Larger Work to be MPL-licensed.

This analysis aligns with the OSI classification of MPL-2.0 as a weak copyleft
license and the Mozilla FAQ on MPL-2.0 compatibility.

## Why LGPL-3.0-or-later Is Accepted

`sharp` itself is Apache-2.0 as of `0.34.5`. The remaining weak-copyleft concern
is the platform-specific `libvips` binary package that `sharp` loads dynamically.

Specifically:

1. **Dynamic linking**: `sharp` loads `libvips` dynamically, which preserves the
   LGPL relinking model without imposing copyleft obligations on Chapa's own code.
2. **No source modifications**: We do not modify or redistribute the `libvips`
   source as part of this project.
3. **Scope remains limited**: LGPL obligations apply to the library itself, not
   to the surrounding MIT-licensed application code.

## Review Policy

When adding new dependencies, verify they use a permissive license (MIT,
Apache-2.0, BSD, ISC). If a dependency uses MPL-2.0, LGPL, or another weak
copyleft license, document it in this file and keep `docs/accepted-risks.md`
aligned with the same package set and justification.
Strong copyleft licenses (GPL, AGPL) are not accepted.

# Third-Party Licenses

This project is licensed under the MIT License (see `LICENSE`). Most dependencies
use permissive licenses (MIT, Apache-2.0, BSD, ISC) that are fully compatible
with MIT.

The following dependencies use the **Mozilla Public License 2.0 (MPL-2.0)**,
which is a weak copyleft license. They are documented here for transparency.

## MPL-2.0 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@resvg/resvg-js` | ^2.6.2 | SVG-to-PNG rasterization for badge rendering |
| `@vercel/analytics` | ^1.6.1 | Vercel web analytics integration |

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

## Review Policy

When adding new dependencies, verify they use a permissive license (MIT,
Apache-2.0, BSD, ISC). If a dependency uses MPL-2.0, LGPL, or another weak
copyleft license, document it in this file with a justification for acceptance.
Strong copyleft licenses (GPL, AGPL) are not accepted.

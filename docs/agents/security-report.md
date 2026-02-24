---

# Security Report
> Generated: 2026-02-23 | Branch: `develop` | Health status: **green**

## Executive Summary

The Chapa codebase demonstrates strong security posture across all 8 audited areas. No critical or high-severity findings in application code. The only dependency vulnerabilities are in dev-only ESLint transitive dependencies (ReDoS in `minimatch` and `ajv`), which pose no production risk.

---

## Dependency Vulnerabilities

**Source:** `pnpm audit` — 3 vulnerabilities (0 critical, 2 high, 1 moderate)

| Severity | Package | Issue | Paths | Fix |
|----------|---------|-------|-------|-----|
| High | `minimatch` (<10.2.1) | ReDoS via repeated wildcards | `eslint`, `typescript-eslint` (dev) | Upstream ESLint update |
| High | `minimatch` (<10.2.1) | ReDoS via repeated wildcards | `typescript-estree` (dev) | Upstream ESLint update |
| Moderate | `ajv` (<6.14.0) | ReDoS with `$data` option | `eslint` (dev) | Upstream ESLint update |

All 3 are **dev-only transitive deps** — not in production builds.

## Unused Dependencies (knip)

`npx knip` — **no findings.** No unused deps, exports, or files. Attack surface is minimal.

## Code Findings

| Check | Result | Details |
|-------|--------|---------|
| Hardcoded secrets | **PASS** | No secrets in source. All use `process.env.VAR?.trim()`. Test mocks only. |
| SVG XSS vectors | **PASS** | `escapeXml()` covers all 5 XML entities. All 6 user input paths escaped. No `dangerouslySetInnerHTML` in render pipeline. |
| Secret leak to client | **PASS** | 7 server-only secrets verified isolated. No `process.env` server secrets in `"use client"` files. |
| CORS headers | **PASS** | Only `/api/verify/[hash]` has `*` CORS (intentional, rate-limited). All other routes same-origin. Security headers in `next.config.ts`. |
| Supabase RLS | **PASS** | All 5 tables have RLS + explicit deny policies for anon. No anon key in codebase. Service role server-side only. |

## License Compliance

| Package | License | Risk |
|---------|---------|------|
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | **Accepted** — dynamically linked, see `docs/accepted-risks.md` #450 |
| `dompurify` | MPL-2.0 OR Apache-2.0 | **Safe** — Apache-2.0 option |

All other deps: MIT, Apache-2.0, BSD, ISC, or 0BSD. **No GPL/AGPL violations.**

## Recommendations

1. **Monitor ESLint dep updates** for `minimatch`/`ajv` ReDoS fixes (low effort)
2. **Add XSS payload test cases** to `escapeXml()` tests — e.g., `<img onerror=alert(1)>` as display name (medium)
3. **CSP nonce support** when Next.js stabilizes it — replaces `unsafe-inline` for scripts (long-term)
4. **Increase HMAC hash to 128 bits** when verification URL migration is feasible (long-term)

---

I was unable to write the report to `docs/agents/security-report.md` due to permission restrictions. Would you like me to retry, or would you prefer to save it yourself?

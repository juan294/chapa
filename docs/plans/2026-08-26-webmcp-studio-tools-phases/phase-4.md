# Phase 4 — Public read tools [batch-eligible with the 2→3 chain]

All tools `readOnlyHint: true`; registered only when `webmcpEnabled`.
Pattern: renderless client components fed by server props — copy
`SharePageShortcuts` (`components/SharePageShortcuts.tsx:1-30`).

## 4A. `/u/[handle]` — new `app/u/[handle]/SharePageWebMcpTools.tsx`

Mounted from `page.tsx` next to `SharePageShortcuts` (:333-337) with
server-computed props: `handle`, redacted `impactForClient`, `stats` summary,
`verification` (`{hash,date}|null`), `trend/diff` (already client props on
this page).

| Tool | execute |
| --- | --- |
| `get_impact_profile` | serialize the redacted impact + key stats from props (no fetch — data is already on the page; note freshness = page render) |
| `get_impact_history` | same-origin `fetch("/api/history/${handle}?include=snapshots,trend")` — connect-src 'self' OK; surface 404/429 as friendly strings |
| `verify_badge` | `fetch("/api/verify/${verification.hash}")` when verification present → status + record + verifyUrl; when null: "This profile has no verification record yet." |
| `explain_dimension` | pure, as Phase 2 (shared helper — extract the tool bodies used by both pages into `lib/webmcp/shared-tools.ts` to avoid duplication) |
| `compare_profiles` | `{other_handle}` → `fetch("/api/profile/${other}")` (same-origin; public handles only, rate limit 60/min surfaces as a friendly message) + diff vs on-page profile |

## 4B. `/verify/[hash]` — new renderless client leaf

`app/verify/[hash]/VerifyPageWebMcpTools.tsx`, mounted only in the
`VerifiedCard` branch (page.tsx:113) with the `VerificationRecord` as props.
Tools: `get_verification_record` (serialize props), `explain_verification`
(static: HMAC-SHA256 over profile fields, what the hash proves and what it
does not — source the copy from the verification docs/i18n).

Files: 2 new components (+render tests with mocked hook), `lib/webmcp/shared-tools.ts`
(+pure tests), `u/[handle]/page.tsx` + `verify/[hash]/page.tsx` mount lines.
NOTE: `u/[handle]/page.test.ts:25-33` forbids studio imports on the share
page — shared-tools must live under `lib/webmcp/`, import nothing from
`app/studio/*`, and the negative test must stay green.

Verification: full gates.

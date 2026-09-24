/** Inserts a `rateLimit { remaining resetAt cost }` selection into a query's
 * top-level selection set. Every GITHUB_EVIDENCE_QUERIES body opens with
 * `query Name(...args...) { ... }` and no `{` appears before that first
 * brace (arguments use only `(...)`), so this is a safe, generic transform.
 *
 * Kept in its own dependency-free module, separate from evidence.ts, so the
 * E2E collection-queue fixture (#1335 phase 4.8) can key its canned
 * responses by the EXACT query text the collection engine actually sends
 * (GITHUB_EVIDENCE_QUERIES alone omits this injected rateLimit selection)
 * without duplicating the transform and risking silent drift. evidence.ts
 * itself imports lib/collection/slice-helpers.ts, which starts with
 * `import "server-only"` -- fine inside Next's webpack build, but that
 * throws unconditionally when required directly by Node (Playwright's test
 * process, or any standalone script). A test file that only needs this pure
 * string transform must not be forced to load that chain.
 */
export function withRateLimit(query: string): string {
  const brace = query.indexOf("{");
  return `${query.slice(0, brace + 1)} rateLimit { remaining resetAt cost }${query.slice(brace + 1)}`;
}

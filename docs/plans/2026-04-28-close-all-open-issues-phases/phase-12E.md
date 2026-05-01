---
phase: 12E
release: v2.12.0
issues: ["#762", "#764", "#777", "#817"]
batch_eligible: true
depends_on: ["12A"]
effort: M
---

# Phase 12E — QA cleanup batch (`#762`, `#764`, `#777`, `#817`)

## Goal

Tighten QA signal: replace string-grep page tests with behavior tests,
cover warm-cache failure paths, refresh stale coverage report, and
silence expected-error noise in passing tests.

## #762 — Server component pages tested via source-string grep

Many `page.test.ts` files do `expect(pageSource).toContain("Hello")`
instead of rendering and asserting on the DOM.

For each `app/**/page.test.ts(x)` that uses string-grep:
- Replace with React Testing Library `render()` + `screen.getByText(...)`
- For Server Components, use the `@testing-library/react`'s server-component
  rendering pattern (or upgrade to `next/testing` if available)
- If the page is purely a Server Component making async data calls, mock
  the data layer at the module boundary and assert on the rendered output

Migrate at most 5 page tests in this phase. Track the rest as a follow-up
issue if needed.

## #764 — `app/api/cron/warm-cache/route.ts` 82% coverage

The uncovered branches are mostly failure paths. Use the failure-aware
mocks added in Phase 9D (#702) to cover:
- `processInBatches` returns >0 failures
- `dbCleanExpiredVerifications` throws
- `dbCleanExpiredMergeOperations` throws
- `dbCleanOldSnapshots` throws
- Token-refresh fail-open behavior

Target: 95%+ line coverage for the route file.

## #777 — Coverage report stale

Coverage report (`docs/coverage.md` or similar — locate during /implement)
is out of date. Either:
- Refresh it once with the current numbers and add a CI step to regenerate
  on each push, OR
- Delete the static doc and rely on Vitest's HTML coverage report (gitignored)
  + a per-PR comment from the test workflow

Recommendation: delete the static doc; lean on tooling. One less manual
artifact to keep current.

## #817 — Passing tests emit expected-error noise

Tests that exercise error paths log expected errors to stderr, which
creates false-positive signals when scanning CI logs. Wrap intentional
error paths with `vi.spyOn(console, "error").mockImplementation(() => {})`
in the appropriate `beforeEach`/`afterEach`.

The standard pattern:

```ts
// In a test that exercises an error path
let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });
```

Sweep tests that intentionally trigger errors (the failure-paths added
in Phase 9D, plus existing error-path tests) and apply the silencer.

## Files

- Modified: ~5 `app/**/page.test.ts(x)` files (#762)
- Modified: `app/api/cron/warm-cache/route.test.ts` (#764)
- Removed or refreshed: `docs/coverage.md` or equivalent (#777)
- Modified: tests that exercise error paths and currently leak stderr
  output (#817)

## Acceptance criteria

### Automated
- [ ] `pnpm run test --coverage` for warm-cache shows ≥ 95% coverage
- [ ] Sample 5 page tests now use behavior assertions, not source-string grep
- [ ] CI test output no longer prints expected-error stack traces
- [ ] `pnpm run typecheck && pnpm run test && pnpm run lint` all pass

### Manual
- Open the coverage HTML report; verify warm-cache route's failure branches
  are now covered
- Look at a CI run's test output; confirm expected errors are silenced

## Closing the issues

```bash
gh issue close 762 --comment "Fixed in <sha>. Five high-traffic page tests migrated to behavior assertions; remainder tracked separately."
gh issue close 764 --comment "Fixed in <sha>. warm-cache route coverage now ≥95%."
gh issue close 777 --comment "Fixed in <sha>. Stale coverage doc removed; coverage now lives in Vitest HTML report only."
gh issue close 817 --comment "Fixed in <sha>. Expected error paths silenced via console.error spy in test setup."
```

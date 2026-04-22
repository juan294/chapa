# Phase 11 — Structural / maintainability

**Source findings:** §6 (all five observations)
**Depends on:** P1 (P1 edits `impact/utils.ts` and `impact/v6.ts` — land it first to avoid merge churn)
**Batch:** no (touches `packages/shared/src/constants.ts` and impact files edited by P1)

## Goal

Consolidate scoring thresholds into `packages/shared/src/constants.ts`, apply consistent Zod row-parsing in the one data-layer module that skipped it (already partly addressed in P7 — this phase verifies and finishes), add a single `fireAndForget()` helper, and make the dimension-color palette single-sourced.

## Files touched

- `packages/shared/src/constants.ts` (central scoring constants)
- `apps/web/lib/impact/utils.ts`, `apps/web/lib/impact/v6.ts` (swap inline literals for constants)
- `apps/web/lib/async/fire-and-forget.ts` (NEW)
- `apps/web/app/api/telemetry/route.ts`, `apps/web/lib/email/campaigns.ts`, `apps/web/app/api/notifications/unsubscribe/route.ts` (use helper)
- `apps/web/lib/render/theme.ts` (derive dimension palette from CSS tokens via a single source or document the three-place invariant)
- Tests: `constants.test.ts` (new invariant assertions), touched files' existing tests

## TDD — Red tests first

```ts
// constants.test.ts
describe("scoring constants are source-of-truth", () => {
  it("BURST_ACTIVITY_THRESHOLD === 100", () => {
    expect(BURST_ACTIVITY_THRESHOLD).toBe(100);
  });
  it("LEAD_TIME_CAPS.fast === 4, .mid === 48, .slow === 168", () => {
    expect(LEAD_TIME_CAPS).toEqual({fast:4, mid:48, slow:168});
  });
  it("TIER_THRESHOLDS match the ones used in v6.ts", () => {
    expect(TIER_THRESHOLDS).toEqual({S:85, A:70, C:30});
  });
  it("BATCH_SIZE_DEFAULT === 0.3", () => {
    expect(BATCH_SIZE_DEFAULT).toBe(0.3);
  });
});

// impact/utils.test.ts — assert call sites use the constants
describe("computeConfidence uses BURST_ACTIVITY_THRESHOLD", () => {
  it("reads the shared constant rather than a local literal", () => {
    const source = readFileSync("apps/web/lib/impact/utils.ts", "utf8");
    expect(source).not.toMatch(/maxCommitsIn10Min >= 100/);   // hardcoded gone
    expect(source).toMatch(/maxCommitsIn10Min >= BURST_ACTIVITY_THRESHOLD/);
  });
});

// async/fire-and-forget.test.ts
describe("fireAndForget", () => {
  it("invokes onError when the promise rejects", async () => {
    const onError = vi.fn();
    fireAndForget(async () => { throw new Error("x"); }, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
  });
  it("is a no-op on resolved promises", async () => {
    const onError = vi.fn();
    fireAndForget(async () => "ok", onError);
    await vi.waitFor(() => expect(onError).not.toHaveBeenCalled());
  });
});
```

## Green — implementation pseudocode

```ts
// packages/shared/src/constants.ts — extend
export const BURST_ACTIVITY_THRESHOLD = 100;              // maxCommitsIn10Min >= 100 → penalty
export const LEAD_TIME_CAPS = { fast: 4, mid: 48, slow: 168 } as const;
export const BATCH_SIZE_DEFAULT = 0.3;
export const TIER_THRESHOLDS = { S: 85, A: 70, C: 30 } as const;
export const MICRO_COMMIT_THRESHOLD = 0.6;
export const SINGLE_REPO_CONCENTRATION = 0.95;
// ... (any other inline literals identified during implementation)
```

```ts
// lib/async/fire-and-forget.ts (NEW)
export function fireAndForget<T>(
  fn: () => Promise<T>,
  onError: (err: unknown) => void = err => console.error("[fire-and-forget]", err),
): void {
  fn().catch(onError);
}
```

```ts
// callsites (e.g. api/telemetry/route.ts)
import { fireAndForget } from "@/lib/async/fire-and-forget";
fireAndForget(
  () => dbInsertTelemetry({...payload, verified: false}),
  err => console.error("[telemetry] insert failed", {handle: payload.targetHandle, err}),
);
```

## Automated success criteria

- New tests green.
- `grep -rn "maxCommitsIn10Min >= [0-9]" apps/web/lib/impact/` → 0 matches (all routed through constant).
- `grep -rn "void .*\.catch" apps/web/` → 0 matches outside the `fire-and-forget.ts` helper.
- `grep -rn ">= 85\|>= 70\|>= 30" apps/web/lib/impact/v6.ts` → 0 matches (tier thresholds sourced from constant).
- `pnpm run typecheck` clean.

## Manual success criteria

- Scoring outputs for a golden handle match pre-phase values bit-for-bit (refactor, not behavior change).
- Dimension colors in share page + badge SVG + design-system docs still match (palette single-source or three-place invariant documented).

## Notes

- The palette tripling is harder to fully eliminate — `globals.css` CSS vars must exist for runtime theme switching, and `lib/render/theme.ts` must expose TS constants because badge SVG is server-rendered pre-CSS. Minimum viable fix: document the invariant in `theme.ts` with a `// source of truth: globals.css` comment and add a unit test asserting hex values match. Full single-source migration is out of scope.
- If P11 discovers that some constants are used in `packages/shared` but with different values than the web-app literal, take the web-app literal as canonical (it's what's shipped) and flag in the phase PR description.

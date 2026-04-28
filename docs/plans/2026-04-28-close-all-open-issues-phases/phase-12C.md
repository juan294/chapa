---
phase: 12C
release: v2.12.0
issues: ["#680"]
batch_eligible: true
depends_on: ["12A"]
effort: M
---

# Phase 12C — Craft propagation regression tests (`#680`)

## Goal

`#680` was filed in March 2026 after three consecutive v2.7.x releases
each shipped a craft-scoring bug. The root cause: each route was tested
in isolation with mocks, so no test verified that `craftScore` actually
propagates from `computeCraftScore` -> route handler -> `computeImpactV6`.

Add three layers of regression coverage:

1. **Propagation consistency test** — walk every call site of
   `computeImpactV6` and assert the call shape includes a `craft`
   parameter (or explicitly opts out).
2. **End-to-end craft pipeline test** — feed real raw insights through
   the full pipeline without mocking `computeCraftScore`, assert the
   resulting impact result has the expected craft field.
3. **CI grep guard** — a script that fails CI if anyone adds a new
   `computeImpactV6(stats)` call without a `craft` argument.

## Pseudocode

```ts
// apps/web/lib/impact/craft-propagation.test.ts (new)
describe("craft propagation contract", () => {
  it("every route that computes impact passes craft when insights exist", async () => {
    const routes = [
      "/api/refresh",
      "/api/recalculate",
      "/api/generate",
      "/u/[handle]/badge.svg",
      "/u/[handle]",
      "/api/cron/warm-cache",
    ];
    for (const route of routes) {
      // Test via direct handler import; provide insights in the test
      // database fixture; assert the computed impact result has
      // craft.score > 0 (proving craft was passed through)
    }
  });
});
```

```ts
// apps/web/lib/impact/pipeline-craft.test.ts (new)
describe("craft pipeline integrity", () => {
  it("aggregation -> craft compute -> impact -> snapshot", () => {
    const rawInsights = makeFullInsights();
    const craft = computeCraftScore(rawInsights); // real, no mock
    const impact = computeImpactV6(makeFullStats(), { craft });
    expect(impact.craft?.score).toBe(craft.score);
    const snapshot = buildSnapshot(impact, { handle: "test", today: "2026-04-28" });
    expect(snapshot.dimensions.craft).toBe(impact.craft?.score);
  });
});
```

```ts
// apps/web/scripts/check-craft-propagation.ts (new)
import { Project } from "ts-morph";

const project = new Project({ tsConfigFilePath: "apps/web/tsconfig.json" });
const offenders: string[] = [];

for (const file of project.getSourceFiles()) {
  for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getText() === "computeImpactV6") {
      const args = call.getArguments();
      if (args.length < 2) {
        offenders.push(`${file.getFilePath()}:${call.getStartLineNumber()}`);
      }
    }
  }
}

if (offenders.length > 0) {
  console.error("computeImpactV6 called without craft argument at:");
  offenders.forEach(o => console.error("  " + o));
  process.exit(1);
}
```

Add to CI workflow:

```yaml
- name: Craft propagation guard
  run: pnpm tsx apps/web/scripts/check-craft-propagation.ts
```

## Files

- New: `apps/web/lib/impact/craft-propagation.test.ts`
- New: `apps/web/lib/impact/pipeline-craft.test.ts`
- New: `apps/web/scripts/check-craft-propagation.ts`
- Modified: `.github/workflows/ci.yml` — add the guard step
- New: `apps/web/lib/test-helpers/fixtures.ts` may need a `makeFullInsights()`
  helper alongside the existing `makeFullStats()`

## Acceptance criteria

### Automated
- [ ] `pnpm run test apps/web/lib/impact/craft-propagation.test.ts` passes
- [ ] `pnpm run test apps/web/lib/impact/pipeline-craft.test.ts` passes
- [ ] `pnpm tsx apps/web/scripts/check-craft-propagation.ts` exits 0 on
      current main; exits 1 if you temporarily delete a craft argument
- [ ] CI workflow includes the new guard step
- [ ] All other tests still pass

### Manual
- Temporarily remove the `craft` argument from `app/api/refresh/route.ts`
  and confirm the guard script catches it; restore the argument

## Closing the issue

```bash
gh issue close 680 --comment "Fixed in <sha>. Three-layer regression coverage: propagation consistency test, end-to-end craft pipeline test, and CI guard script (apps/web/scripts/check-craft-propagation.ts) that fails CI on new computeImpactV6 calls without craft."
```

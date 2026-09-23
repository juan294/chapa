import { describe, it, expect } from "vitest";
import { DEMO_IMPACT } from "./demoData";
import { LANDING_IMPACT } from "./landing-demo-data";
import { LANDING_OBSERVED_DEMO } from "./observed-demo-data";
import { renderableScore } from "@/lib/profile/score-view-model";

// #1335 phase 5 — v6 is retired. `LANDING_IMPACT` is now the same curated
// v7.2 illustrative view model as `LANDING_OBSERVED_DEMO` (CLAUDE.md:
// landing sample stays 92 / Elite / Balanced, independent of the shared
// Studio 82/High/Balanced sample).
describe("curated landing sample", () => {
  it("is exactly the 92/Elite/Balanced LANDING_OBSERVED_DEMO view model", () => {
    expect(LANDING_IMPACT).toBe(LANDING_OBSERVED_DEMO);
    const drawn = renderableScore(LANDING_IMPACT);
    expect(drawn.composite).toBe(92);
    expect(drawn.tier).toBe("Elite");
    expect(drawn.archetype).toBe("Balanced");
  });

  it("is a distinct sample from the shared Studio demo", () => {
    expect(LANDING_IMPACT).not.toBe(DEMO_IMPACT);
    expect(renderableScore(DEMO_IMPACT).composite).toBe(82);
  });

  // renderBadgeSvg integration coverage for LANDING_IMPACT now lives with
  // lib/render/BadgeSvg.tsx's own render test suite (owned outside this
  // workstream), which exercises the renderer's real (post-#1335) signature.
});

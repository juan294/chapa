import { describe, expect, it } from "vitest";
import { assertRenderableBadgeBody } from "./deployment-probes";

// badge-source-outage-resilience: the release badge probe (v3.0.0) accepted
// ANY HTTP 200 SVG wrapper, so the generic load-error artifact (still a 200,
// still valid SVG) passed release verification while the public badge showed
// no data. `assertRenderableBadgeBody` is the pure body assertion that
// closes that gap: it requires the rendered-artifact machine marker and
// rejects the fallback marker, without ever keying on localized copy (a
// translation edit must never change what the probe checks).
describe("assertRenderableBadgeBody", () => {
  it("accepts a rendered/current badge body", () => {
    const body =
      '<svg xmlns="http://www.w3.org/2000/svg" data-badge-design="ice-terminal-v2" data-chapa-state="rendered" data-chapa-freshness="current" role="img"><title>octocat</title></svg>';
    expect(() => assertRenderableBadgeBody(body)).not.toThrow();
  });

  it("accepts a rendered/stale badge body (an available product artifact)", () => {
    const body =
      '<svg xmlns="http://www.w3.org/2000/svg" data-badge-design="ice-terminal-v2" data-chapa-state="rendered" data-chapa-freshness="stale" role="img"><title>octocat</title></svg>';
    expect(() => assertRenderableBadgeBody(body)).not.toThrow();
  });

  it("rejects the English generic load-error fallback", () => {
    const body =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" data-chapa-state="fallback" data-chapa-reason="load-error">' +
      '<text x="60" y="400">Could not load data. Try again later.</text></svg>';
    expect(() => assertRenderableBadgeBody(body)).toThrow();
  });

  it("rejects the Spanish generic load-error fallback", () => {
    const body =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" data-chapa-state="fallback" data-chapa-reason="load-error">' +
      '<text x="60" y="400">No se pudieron cargar los datos. Inténtalo de nuevo más tarde.</text></svg>';
    expect(() => assertRenderableBadgeBody(body)).toThrow();
  });

  it("rejects a body with no machine state marker at all", () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    expect(() => assertRenderableBadgeBody(body)).toThrow();
  });

  // #1335: a subject with no drawable receipt renders a real product state,
  // not the error artifact. Right after a release no subject has a receipt
  // yet, so the production probe must accept these states.
  it.each(["unregistered", "collecting", "action_needed"])("accepts the %s scoring-state badge", (state) => {
    const body = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" data-chapa-state="${state}"><text>octocat</text></svg>`;
    expect(() => assertRenderableBadgeBody(body)).not.toThrow();
  });

  it("rejects the unavailable authority-failure badge", () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" data-chapa-state="unavailable"><text>x</text></svg>';
    expect(() => assertRenderableBadgeBody(body)).toThrow();
  });
});

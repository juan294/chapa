// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";
import { explainObservedReceipt } from "@/lib/dashboard/receipt-explanation";
import { calculateReportCraftInputs } from "@/lib/insights/report-craft";
import { ImpactDashboard } from "./ImpactDashboard";
vi.mock("./ActivityHeatmap", () => ({ ActivityHeatmap: () => <div>Descriptive activity</div> }));
vi.mock("./StatsGrid", () => ({ StatsGrid: () => <div>Descriptive source counts</div> }));
vi.mock("@/lib/effects/counters/use-in-view", () => ({ useInView: () => true }));
vi.mock("@/lib/effects/counters/use-animated-counter", () => ({ useAnimatedCounter: (target: number) => ({ value: target, isAnimating: false, animate: vi.fn() }) }));
afterEach(cleanup);
it.each([57, 0] as const)("shows the exact receipt core46 and fifth Craft%s instead of contradictory legacy scores", async craft => {
  const f = await scoringConsistencyFixture({ craft });
  const explanation = explainObservedReceipt({ receipt: f.envelope, trend: null }, Date.parse(f.envelope.receipt.window.referenceTime));
  render(<ImpactDashboard stats={f.stats} scoring={f.model} receiptExplanation={explanation} />);
  expect(screen.getByText("46")).toBeDefined();
  expect(screen.queryByText("Builder")).toBeNull();
  expect(screen.queryByText("83")).toBeNull();
  expect(screen.queryByText(/points to.*Elite/i)).toBeNull();
  const cards = screen.getAllByRole("article");
  expect(cards).toHaveLength(5);
  const craftCard = screen.getByRole("article", { name: new RegExp(`Craft.*${craft}`) });
  expect(within(craftCard).getByRole("progressbar").getAttribute("aria-valuenow")).toBe(String(craft));
  fireEvent.click(within(craftCard).getByRole("button", { expanded: false }));
  expect(within(craftCard).queryByText(/proficiency|sophistication|Master|Expert/i)).toBeNull();
  expect(within(craftCard).getAllByText(/report/i).length).toBeGreaterThan(0);
});
// #1331 — the v7.2 branch draws ActivityHeatmap unconditionally too; a
// stored-badge fallback must hide it here exactly like the v6 branch.
it("hides the activity heatmap for a v7.2 model when activityUnavailable is set", async () => {
  const f = await scoringConsistencyFixture({ craft: "none" });
  render(<ImpactDashboard stats={f.stats} scoring={f.model} activityUnavailable />);
  expect(screen.queryByText("Descriptive activity")).toBeNull();
  expect(screen.getByText("Descriptive source counts")).toBeDefined();
});

it("keeps no report at four cards and expired Craft unlocked without a fabricated zero", async () => {
  const absent = await scoringConsistencyFixture({ craft: "none" });
  const view = render(<ImpactDashboard stats={absent.stats} scoring={absent.model} />);
  expect(screen.getAllByRole("article")).toHaveLength(4);
  const expired = await scoringConsistencyFixture({ craft: "expired" });
  view.rerender(<ImpactDashboard stats={expired.stats} scoring={expired.model} />);
  expect(screen.getAllByRole("article")).toHaveLength(5);
  const card = screen.getByRole("article", { name: /Craft/ });
  expect(within(card).queryByRole("progressbar")).toBeNull();
  expect(within(card).queryByText("0")).toBeNull();
  expect(within(card).queryByText("57")).toBeNull();
});

it("offers report recovery only to the owner for absent and insufficient reports", async () => {
  const f = await scoringConsistencyFixture({ craft: "none" });
  const view = render(<ImpactDashboard stats={f.stats} scoring={f.model} isOwner />);
  expect(screen.getByText("No insights report")).toBeDefined();
  expect(screen.getByRole("link", { name: "Upload insights" }).getAttribute("href")).toBe("/settings");
  const scored = await scoringConsistencyFixture({ craft: 57 });
  if (scored.model.reportCraft?.status !== "scored") throw new Error("Expected report");
  const calculation = calculateReportCraftInputs({ ...scored.model.reportCraft.report.inputs,
    totalSessions: 0, outcomes: { fully_achieved: 0, mostly_achieved: 0, partially_achieved: 0, not_achieved: 0 }, unknownSessions: 0, unclassifiedSessions: 0 });
  if (calculation.status !== "valid" || calculation.result.status !== "insufficient_report_data") throw new Error("Expected insufficient report");
  const model = { ...f.model, reportCraft: { status: "insufficient_report_data" as const, unlocked: false as const,
    report: { inputs: calculation.inputs, result: calculation.result } } };
  view.rerender(<ImpactDashboard stats={f.stats} scoring={model} isOwner />);
  expect(screen.getAllByRole("article")).toHaveLength(4);
  expect(screen.getByText("Insufficient report data")).toBeDefined();
  expect(screen.getByRole("link", { name: "Update insights" }).getAttribute("href")).toBe("/settings");
  view.rerender(<ImpactDashboard stats={f.stats} scoring={model} isOwner={false} />);
  expect(screen.getByText("Insufficient report data")).toBeDefined();
  expect(screen.queryByRole("link", { name: /insights/i })).toBeNull();
});

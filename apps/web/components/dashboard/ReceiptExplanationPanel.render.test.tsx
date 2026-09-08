// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { buildReceiptSnapshotV7 } from "@/lib/history/snapshot";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { explainReceipt } from "@/lib/dashboard/receipt-explanation";
import { ReceiptExplanationPanel } from "./ReceiptExplanationPanel";

afterEach(cleanup);

describe("ReceiptExplanationPanel (#1311)", () => {
  it("renders the receipt's own numbers, not a recomputation", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const explanation = explainReceipt(snapshot);

    render(<ReceiptExplanationPanel explanation={explanation} />);

    // The four fixed dimensions each appear with their own steps.
    expect(screen.getAllByRole("heading", { level: 4 }).length).toBeGreaterThanOrEqual(4);
    // The headline shown is the receipt's composite, to one decimal.
    const composite = Math.round(explanation.composite.lower * 10) / 10;
    expect(screen.getByText(String(composite))).toBeDefined();
  });

  it("shows an interval rather than inventing a midpoint", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9, undefined, true), null);
    const explanation = explainReceipt(snapshot);
    expect(explanation.composite.lower).not.toBe(explanation.composite.upper);

    render(<ReceiptExplanationPanel explanation={explanation} />);

    const lower = Math.round(explanation.composite.lower * 10) / 10;
    const upper = Math.round(explanation.composite.upper * 10) / 10;
    expect(screen.getByText(`${lower}–${upper}`)).toBeDefined();
    // A midpoint would be the false precision the range policy exists to avoid.
    expect(screen.queryByText(String((lower + upper) / 2))).toBeNull();
  });

  it("says Craft is not observed rather than drawing it as a zero", async () => {
    const snapshot = buildReceiptSnapshotV7(await receiptFixtureV7("2026-09-01", 9), null);
    const explanation = explainReceipt(snapshot);

    render(<ReceiptExplanationPanel explanation={explanation} />);

    expect(screen.getByText(/not observed/i)).toBeDefined();
    expect(screen.getByText(/never enters the core/i)).toBeDefined();
  });
});

it("prints canonical current points while expanded arithmetic retains exact trace and report credits", async () => {
  const { scoringConsistencyFixture } = await import("@/lib/profile/__fixtures__/scoring-consistency");
  const { explainObservedReceipt } = await import("@/lib/dashboard/receipt-explanation");
  const fixture = await scoringConsistencyFixture({ craft: 57, boundary: true });
  const explanation = explainObservedReceipt({ receipt: fixture.envelope, trend: null }, Date.parse(fixture.envelope.receipt.window.referenceTime));
  render(<ReceiptExplanationPanel explanation={explanation} />);
  expect(screen.getByText(fixture.envelope.receipt.core.composite.displayLabel)).toBeDefined();
  expect(screen.getByText("57")).toBeDefined();
  expect(screen.getByText(/5\.7 \/ 10 × 100 = 57/)).toBeDefined();
  expect(screen.getAllByText(/ln\(1 \+/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/interval rather than a midpoint/i)).toBeNull();
  expect(screen.queryByText(/proficiency|Master|Expert/i)).toBeNull();
});

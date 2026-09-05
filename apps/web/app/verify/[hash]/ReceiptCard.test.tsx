// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { sealScoreReceipt, type CraftScoringInputs } from "@chapa/shared";
import { receiptFixtureV7 } from "@/lib/history/__fixtures__/receipts-v7";
import { calculateCraftV7 } from "@/lib/insights/craft-v7";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { resolveTranslation } from "@/lib/i18n/resolve";
import type { ReceiptVerificationV7 } from "@/lib/verification/types";
import { ReceiptCard } from "./ReceiptCard";
afterEach(cleanup);
const token = `v7.11111111-1111-4111-8111-111111111111.${"a".repeat(64)}`;
const t = (key: string) => resolveTranslation(key, en);
async function record(episodes: number | null = null, range = false): Promise<Exclude<ReceiptVerificationV7, { status: "revoked" }>> {
  let envelope = await receiptFixtureV7("2026-09-01", 4, undefined, range);
  if (episodes !== null) {
    const inputs: CraftScoringInputs = { policyVersion: "v7", window: envelope.receipt.window, eligibleEpisodes: episodes, independentlyCorroboratedCompleteEpisodes: 0, counts: { framing: { lower: 0, upper: 0 }, verification_debugging: { lower: 0, upper: 0 }, tool_judgment: { lower: 0, upper: 0 }, accepted_outcome: { lower: 0, upper: 0 } } };
    const craft = calculateCraftV7(inputs);
    envelope = await sealScoreReceipt({ ...envelope.receipt, craft: { inputs, result: craft.result }, calculation: { ...envelope.receipt.calculation, craft: craft.trace } });
  }
  return { version: "v7", status: "current", revisionId: envelope.receipt.revisionId, issuanceRecorded: true, signatureAuthenticated: true, keyVersion: "v7-1", arithmetic: "offline_replay_available", sourceEvidence: "not_verified", envelope };
}
it("preserves Craft absent, no observations, and measured zero without changing the core", async () => {
  const absent = await record(), unobserved = await record(0), zero = await record(1);
  expect(absent.envelope.receipt.core).toEqual(zero.envelope.receipt.core);
  const view = render(<ReceiptCard token={token} result={absent} t={t} />);
  expect(screen.getByText("Craft was not included")).toBeDefined();
  view.rerender(<ReceiptCard token={token} result={unobserved} t={t} />);
  expect(screen.getByText("No eligible Craft episodes were observed")).toBeDefined();
  view.rerender(<ReceiptCard token={token} result={zero} t={t} />);
  expect(screen.getByText("0")).toBeDefined();
  expect(screen.queryByText("Craft was not included")).toBeNull();
});
it("labels evidence ranges and unavailable signature authentication independently", async () => {
  const result = { ...await record(null, true), status: "superseded" as const, signatureAuthenticated: false };
  render(<ReceiptCard token={token} result={result} t={t} />);
  expect(screen.getByText("Superseded historical revision")).toBeDefined();
  expect(screen.getByText("Signature not authenticated with the available key")).toBeDefined();
  expect(screen.getByText(/not a statistical confidence interval/)).toBeDefined();
  expect(screen.queryByText("Signature authenticated")).toBeNull();
});
it("renders Spanish receipt and revocation copy without exposing score content after revocation", async () => {
  const spanish = (key: string) => resolveTranslation(key, es);
  const result = await record();
  const view = render(<ReceiptCard token={token} result={result} t={spanish} />);
  expect(screen.getByRole("heading", { name: "Recibo de puntuación" })).toBeDefined();
  view.rerender(<ReceiptCard token={token} result={{ version: "v7", status: "revoked", revisionId: result.revisionId, signatureAuthenticated: false }} t={spanish} />);
  expect(screen.getByRole("heading", { name: "Recibo revocado" })).toBeDefined();
  expect(screen.queryByText("Puntuación principal")).toBeNull();
});

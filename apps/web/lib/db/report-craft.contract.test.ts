import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createScoringWindow, canonicalJson } from "@chapa/shared";
import { prepareReportCraftImport } from "@/lib/insights/report-craft-import";
import { dbStoreReportCraft, dbReadReportCraft, dbPublishObservedReceiptWithReport } from "./report-craft";
import { observedReceiptFixture } from "@/lib/history/__fixtures__/receipts-observed";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";
const owner = "contract-report-craft";
const db = () => getServiceClient();
const capture = "2026-09-08T12:00:00.000Z";
const dto = (outcomes = [{ label: "Fully Achieved", count: 4 }, { label: "Mostly Achieved", count: 2 }, { label: "Partially Achieved", count: 1 }, { label: "Failed", count: 1 }, { label: "private label", count: 1 }], end = "2026-09-08") => ({ schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start: "2026-09-01", end }, totalSessions: 10, outcomes });
const save = async (value = dto(), ack = true, supersedesReportId?: string, capturedAt = capture) => dbStoreReportCraft(owner, owner, await prepareReportCraftImport(value, capturedAt), { publicationAcknowledged: ack, supersedesReportId });
async function cleanup() { assertLocalSqlTarget(); expect((await db().rpc("scoring_v7_withdraw", { p_owner: owner })).error).toBeNull(); }
beforeEach(cleanup); afterEach(cleanup);
describe("report Craft durable publication admission", () => {
  it("grants report tables and publication RPCs only to service role", () => {
    const grants = inspectLocalSql("SELECT has_table_privilege('anon','public.report_craft_reports','SELECT') AS anon_report,has_table_privilege('authenticated','public.report_craft_selection','UPDATE') AS auth_selection,has_table_privilege('service_role','public.report_craft_reports','SELECT') AS service_report,has_function_privilege('anon','public.scoring_report_craft_read(text,timestamp with time zone)','EXECUTE') AS anon_rpc,has_function_privilege('authenticated','public.scoring_report_craft_store(text,text,jsonb,boolean,uuid)','EXECUTE') AS auth_rpc,has_function_privilege('service_role','public.scoring_observed_publish_with_report(text,text,jsonb,text,text,uuid,bigint,uuid,text)','EXECUTE') AS service_rpc");
    expect(grants).toBe("f|f|t|f|f|t");
  });
  it("fences an earlier no-report read when first insufficient evidence is admitted", async () => {
    await db().rpc("scoring_v7_ledger_write", { p_owner: owner, p_actor: owner, p_action: "consent", p_data: { publicationAcknowledged: true, enabled: true } });
    const before = await dbReadReportCraft(owner, createScoringWindow(capture));
    if (before.status !== "found") throw new Error("Expected consent");
    const envelope = await observedReceiptFixture({ referenceTime: capture, craft: before.craft });
    await save(dto([{ label: "Unknown", count: 10 }]));
    expect(await dbPublishObservedReceiptWithReport(owner, owner, envelope, "a".repeat(64), before.selectedReportId, before.generation)).toEqual({ status: "failed" });
  });
  it("binds a selected-null publication to durable insufficient inputs rather than a forged valid envelope", async () => {
    await save(dto([{ label: "Unknown", count: 10 }]));
    const read = await dbReadReportCraft(owner, createScoringWindow(capture));
    if (read.status !== "found" || read.craft.status !== "insufficient_report_data") throw new Error("Expected insufficient report");
    const hidden = await observedReceiptFixture({ referenceTime: capture, craft: { status: "no_report", unlocked: false, report: null } });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, hidden, "a".repeat(64), null, read.generation)).toEqual({ status: "failed" });
    const forged = await prepareReportCraftImport({ ...dto([{ label: "Unknown", count: 11 }]), totalSessions: 11 }, capture);
    if (forged.calculation.result.status !== "insufficient_report_data") throw new Error("Expected insufficient calculation");
    const altered = await observedReceiptFixture({ referenceTime: capture, craft: { status: "insufficient_report_data", unlocked: false,
      report: { inputs: forged.calculation.inputs, result: forged.calculation.result } } });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, altered, "a".repeat(64), null, read.generation)).toEqual({ status: "failed" });
    const valid = await observedReceiptFixture({ referenceTime: capture, craft: read.craft });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, valid, "a".repeat(64), null, read.generation)).toMatchObject({ status: "inserted", isCurrent: true });
  });
  it("orders competing reports by effective observation cutoff, not the declared start", async () => {
    const first = await save(dto(), true, undefined, "2026-09-08T10:00:00.000Z");
    if (first.status !== "stored") throw new Error("Expected first report");
    const slow = { ...dto([{ label: "Failed", count: 10 }]), reportPeriod: { start: "2026-09-02", end: "2026-09-08" } };
    expect(await save(slow, true, undefined, "2026-09-08T09:00:00.000Z")).toMatchObject({ status: "stored", selection: "older", selectedReportId: first.reportId });
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toMatchObject({ craft: { report: { result: { point: { exact: 57 } } } } });
  });
  it("selects a retained eligible shorter report when the longer current report straddles next day's window", async () => {
    const short = await save(dto([{ label: "Failed", count: 10 }], "2026-09-07"));
    if (short.status !== "stored") throw new Error("Expected shorter report");
    const long = { ...dto(), reportPeriod: { start: createScoringWindow(capture).startInclusive.slice(0, 10), end: "2026-09-08" } };
    expect(await save(long)).toMatchObject({ status: "stored", selection: "selected", generation: 2 });
    expect(await dbReadReportCraft(owner, createScoringWindow("2026-09-09T12:00:00.000Z"))).toMatchObject({ status: "found", selectedReportId: short.reportId, generation: 3, craft: { status: "scored", report: { result: { point: { exact: 0 } } } } });
    // An older in-flight context cannot rewind the selected identity.
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toMatchObject({ status: "found", selectedReportId: short.reportId, generation: 3 });
  });
  it("requires first inline acknowledgment, reuses consent and persists numeric57 with opaque identity", async () => {
    expect(await save(dto(), false)).toMatchObject({ status: "consent_required", persisted: false });
    const saved = await save();
    expect(saved).toMatchObject({ status: "stored", persisted: true, consented: true, selection: "selected", generation: 1 });
    const read = await dbReadReportCraft(owner, createScoringWindow(capture));
    expect(read).toMatchObject({ status: "found", craft: { status: "scored", unlocked: true, report: { result: { point: { exact: 57 } } } } });
    if (read.status !== "found") throw new Error("Expected stored report");
    expect(JSON.stringify(read.craft)).not.toContain("private label");
    expect(read.selectedReportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await save(dto(), false)).toMatchObject({ status: "stored", generation: 1, selection: "unchanged" });
  });
  it("deduplicates concurrent uploads and retains first capture through later and next-day retries", async () => {
    const outcomes = await Promise.all([save(), save()]);
    expect(outcomes.every(row => row.status === "stored")).toBe(true);
    if (outcomes[0]?.status !== "stored") throw new Error("Expected persisted report");
    const first = outcomes[0];
    expect(await save(dto(), false, undefined, "2026-09-09T12:00:00.000Z")).toMatchObject({ status: "stored", reportId: first.reportId, generation: 1 });
    const read = await dbReadReportCraft(owner, createScoringWindow("2026-09-09T12:00:00.000Z"));
    expect(read).toMatchObject({ craft: { report: { inputs: { reportPeriod: { endExclusive: capture } } } } });
    expect((await db().from("report_craft_reports").select("id").eq("owner_handle", owner)).data).toHaveLength(1);
  });
  it("requires explicit same-declared-period correction and legitimate0 remains selected", async () => {
    const first = await save();
    if (first.status !== "stored") throw new Error("Expected persisted report");
    const zero = dto([{ label: "Failed", count: 10 }]);
    expect(await save(zero)).toMatchObject({ status: "correction_required", persisted: false, supersedesReportId: first.reportId });
    expect(await save(zero, true, first.reportId)).toMatchObject({ status: "stored", selection: "selected", generation: 2 });
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toMatchObject({ craft: { status: "scored", report: { result: { point: { exact: 0 } }, supersedesReportRef: first.reportId } } });
  });
  it("keeps valid57 selected after newer insufficient or older valid imports", async () => {
    const first = await save();
    if (first.status !== "stored") throw new Error("Expected persisted report");
    const insufficient = dto([{ label: "Unknown", count: 10 }]);
    expect(await save(insufficient, true, first.reportId)).toMatchObject({ status: "stored", selection: "insufficient", selectedReportId: first.reportId, generation: 1 });
    expect(await save(dto([{ label: "Failed", count: 10 }], "2026-09-07"))).toMatchObject({ status: "stored", selection: "older", selectedReportId: first.reportId });
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toMatchObject({ craft: { report: { result: { point: { exact: 57 } } } } });
  });
  it("retains numeric replay through actual raw-body purge; expiry retains last-report capability", async () => {
    await save();
    inspectLocalSql(`UPDATE public.scoring_v7_raw_artifacts SET created_at=now()-interval '31 days',expires_at=now()-interval '1 day' WHERE owner_handle='${owner}'`);
    expect((await db().rpc("scoring_v7_purge_expired_raw")).error).toBeNull();
    expect((await db().from("scoring_v7_raw_artifacts").select("id").eq("owner_handle", owner)).data).toEqual([]);
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toMatchObject({ craft: { report: { result: { point: { exact: 57 } } } } });
    expect(await dbReadReportCraft(owner, createScoringWindow("2027-09-09T12:00:00.000Z"))).toMatchObject({ craft: { status: "expired", unlocked: true, report: null, lastReport: { result: { point: { exact: 57 } } } } });
  });
  it("fences a slow receipt writer against a newer selected report", async () => {
    await save();
    const before = await dbReadReportCraft(owner, createScoringWindow(capture));
    if (before.status !== "found") throw new Error("Expected report");
    const envelope = await observedReceiptFixture({ referenceTime: capture, craft: before.craft });
    const next = await save(dto([{ label: "Failed", count: 10 }]), true, before.selectedReportId!);
    expect(next.status).toBe("stored");
    expect(await dbPublishObservedReceiptWithReport(owner, owner, envelope, "a".repeat(64), before.selectedReportId, before.generation)).toEqual({ status: "failed" });
    expect((await db().from("scoring_v7_receipts").select("id").eq("owner_handle", owner)).data).toEqual([]);
  });
  it("rejects a report writer whose frozen core baseline has been displaced", async () => {
    await save();
    const read = await dbReadReportCraft(owner, createScoringWindow(capture));
    if (read.status !== "found") throw new Error("Expected selected report");
    const baseline = await observedReceiptFixture({ referenceTime: capture, craft: read.craft });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, baseline, "a".repeat(64), read.selectedReportId, read.generation)).toMatchObject({ status: "inserted" });
    const current = await observedReceiptFixture({ referenceTime: capture, delivery: 12, craft: read.craft });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, current, "b".repeat(64), read.selectedReportId, read.generation)).toMatchObject({ status: "inserted" });
    const slow = await observedReceiptFixture({ referenceTime: capture, craft: read.craft });
    expect(await dbPublishObservedReceiptWithReport(owner, owner, slow, "c".repeat(64), read.selectedReportId, read.generation, baseline.receipt.revisionId)).toEqual({ status: "failed" });
    expect((await db().from("scoring_observed_current").select("receipt_id").eq("owner_handle", owner)).data).toEqual([{ receipt_id: current.receipt.revisionId }]);
  });
  it("allows a current fenced receipt and cascades reports on withdrawal", async () => {
    await save();
    const read = await dbReadReportCraft(owner, createScoringWindow(capture));
    if (read.status !== "found") throw new Error("Expected report");
    const envelope = await observedReceiptFixture({ referenceTime: capture, craft: read.craft });
    const result = await dbPublishObservedReceiptWithReport(owner, owner, envelope, "a".repeat(64), read.selectedReportId, read.generation, undefined, "c".repeat(64));
    expect(result).toMatchObject({ status: "inserted", isCurrent: true, coreSemanticDigest: "c".repeat(64) });
    if (result.status !== "failed") expect(canonicalJson(result.envelope)).toBe(canonicalJson(envelope));
    await cleanup();
    expect((await db().from("report_craft_reports").select("id").eq("owner_handle", owner)).data).toEqual([]);
    expect(await dbReadReportCraft(owner, createScoringWindow(capture))).toEqual({ status: "not_consented" });
  });
});

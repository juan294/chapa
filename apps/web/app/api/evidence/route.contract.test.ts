import { afterAll, describe, expect, it, vi } from "vitest";
import { invokeJson, makeCliBearer, getServiceClient, seedUser, cleanupUser, bodyAsRecord } from "@/test/contract/invoke";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
import { POST, GET } from "./route";
const owner = "contract-evidence-owner";
const reviewer = "contract-evidence-reviewer";
async function write(actor: string, body: unknown) {
  return invokeJson(POST, { method: "POST", path: "/api/evidence", bearer: makeCliBearer(actor), body });
}
afterAll(async () => {
  await getServiceClient().rpc("scoring_v7_withdraw", { p_owner: owner });
  await cleanupUser(owner); await cleanupUser(reviewer);
});
describe("POST /api/evidence complete local workflow", () => {
  it("supports owner no-report claims, reviewer verdicts, amendments/retractions, and retires consent/withdrawal", async () => {
    await seedUser(owner); await seedUser(reviewer);
    const body = { action: "claim", owner, channel: "core", previousRevisionId: null, category: "performance_accessibility", artifactRevision: "sha-1",
      occurredAt: "2026-08-01T00:00:00Z", claim: "Reduced measured response time", baseline: { kind: "measured", value: "100ms" }, observedResult: "80ms",
      method: "Fixed query sample", contributorRole: "Implemented query", attribution: "individual",
      observationPeriod: { startInclusive: "2026-08-02T00:00:00Z", endExclusive: "2026-09-01T00:00:00Z" },
      references: [{ artifactUri: "https://github.com/example/repository/pull/1", artifactRevision: "sha-1", observedAt: "2026-09-01T00:00:00Z" }],
      limitations: ["Single workload"], counterevidence: ["Increased memory use"] };
    expect((await write(reviewer, body)).status).toBe(403);
    const submitted = await write(owner, body);
    expect(submitted.status).toBe(200);
    const stored = bodyAsRecord(submitted);
    expect((await getServiceClient().from("scoring_v7_evidence").select("payload").eq("id", stored.revisionId)).data?.[0]?.payload.provenance).toBe("self_reported");
    const review = { action: "assessment", owner, previousRevisionId: null, claimRevisionId: stored.revisionId,
      criterion: "verification", status: "accepted", rubricVersion: "v7", rationale: "Inspected before/after reproducible query results", evaluatorType: "human", evaluatorVersion: "1", independentlyCorroborated: true,
      conflicts: [], referenceIds: stored.referenceIds, facts: null };
    expect((await write(owner, review)).status).toBe(403);
    expect((await write(reviewer, review)).status).toBe(403);
    expect((await write(owner, { action: "grant", owner, reviewer, enabled: true })).status).toBe(200);
    const verdict = await write(reviewer, review);
    expect(verdict.status).toBe(200);
    expect((await write(reviewer, { ...review, previousRevisionId: bodyAsRecord(verdict).revisionId, status: "retracted" })).status).toBe(200);
    const corrected = await write(owner, { ...body, previousRevisionId: stored.revisionId, observedResult: "82ms after remeasurement" });
    expect(corrected.status).toBe(200);
    expect((await write(owner, { action: "retract", owner, revisionId: bodyAsRecord(corrected).revisionId, rationale: "Measurement superseded" })).status).toBe(200);
    expect((await write(owner, { ...body, channel: "craft", previousRevisionId: null })).status).toBe(200);
    const privateRead = await invokeJson(GET, { method: "GET", path: `/api/evidence?owner=${owner}`, bearer: makeCliBearer(reviewer) });
    expect(privateRead.status).toBe(200);
    expect((await write(owner, { action: "grant", owner, reviewer, enabled: false })).status).toBe(200);
    expect((await invokeJson(GET, { method: "GET", path: `/api/evidence?owner=${owner}`, bearer: makeCliBearer(reviewer) })).status).toBe(403);
    // Publication consent is retired (#1335 phase 2): the ledger no longer
    // recognizes "consent" at all, and "withdraw" is a recognized shape only
    // so the route can answer with a specific, honest error.
    expect((await write(owner, { action: "consent", owner, enabled: true, publicationAcknowledged: true })).status).toBe(400);
    const withdrawal = await write(owner, { action: "withdraw", owner });
    expect(withdrawal.status).toBe(400);
    expect(bodyAsRecord(withdrawal)).toEqual({ error: "retired_action" });
  });
});

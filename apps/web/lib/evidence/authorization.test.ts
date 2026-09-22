import { describe, expect, it } from "vitest";
import { ledgerAuthorityGrantedAt } from "./authorization";
import { ledgerFixture } from "./test-fixtures";
const assessment = ledgerFixture().assessments[0]!.assessment;
const authority = { version: "ledger-authority-v1", ownerId: "owner", evaluatorId: "reviewer", grantedAt: "2026-09-01T00:00:00Z", assessedAt: assessment.assessedAt, recordedAt: assessment.recordedAt };
describe("immutable ledger authority", () => {
  it("retains a captured verdict without consulting a later revoked/regranted mutable grant", () => {
    expect(ledgerAuthorityGrantedAt("owner", assessment, authority)).toBe("2026-09-01T00:00:00.000Z");
  });
  it.each([{ ownerId: "other" }, { evaluatorId: "other" }, { grantedAt: "2026-09-03T00:00:00Z" }, { assessedAt: "2026-09-01T00:00:00Z" }, { recordedAt: "bad" }, { version: "caller" }])("rejects mismatched authority %j", patch => {
    expect(ledgerAuthorityGrantedAt("owner", assessment, { ...authority, ...patch })).toBeNull();
  });
});

it("normalizes PostgreSQL microseconds at the trusted database boundary", () => {
  const time = "2026-09-02T00:00:00.123456+00:00";
  const canonical = { ...assessment, assessedAt: "2026-09-02T00:00:00.123Z", recordedAt: "2026-09-02T00:00:00.123Z" };
  expect(ledgerAuthorityGrantedAt("owner", canonical, { ...authority, assessedAt: time, recordedAt: time })).toBe("2026-09-01T00:00:00.000Z");
});

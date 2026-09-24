import { describe, expect, it } from "vitest";
import { GITHUB_EVIDENCE_QUERIES } from "./evidence-queries";

describe("GITHUB_EVIDENCE_QUERIES", () => {
  // The server GITHUB_TOKEN carries `repo` only. A ProjectV2 field needs
  // `read:project`, and GitHub rejects the whole query with
  // INSUFFICIENT_SCOPES (production, 2026-09-24: every issue closed from a
  // project board stopped its GitHub collection job).
  it("never selects ProjectV2 fields, which need the read:project scope", () => {
    for (const [name, query] of Object.entries(GITHUB_EVIDENCE_QUERIES)) {
      expect(query, name).not.toMatch(/ProjectV2/);
    }
  });
});

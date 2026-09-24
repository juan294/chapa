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

  // Unbounded author-filtered history walks a repository's whole past and
  // answered 502 on large histories (production, 2026-09-24).
  it("bounds commit history by a since timestamp and pages of at most 50", () => {
    expect(GITHUB_EVIDENCE_QUERIES.commits).toMatch(/history\(first: 50, after: \$after, since: \$since, author: \{id: \$subjectId\}\)/);
    expect(GITHUB_EVIDENCE_QUERIES.commits).toMatch(/\$since: GitTimestamp!/);
  });
});

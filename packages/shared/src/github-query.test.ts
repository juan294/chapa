import { describe, it, expect } from "vitest";
import { CONTRIBUTION_QUERY } from "./github-query";

describe("CONTRIBUTION_QUERY", () => {
  it("is a non-empty string", () => {
    expect(typeof CONTRIBUTION_QUERY).toBe("string");
    expect(CONTRIBUTION_QUERY.length).toBeGreaterThan(100);
  });

  it("queries user by login", () => {
    expect(CONTRIBUTION_QUERY).toContain("user(login: $login)");
  });

  it("uses both DateTime and GitTimestamp variables", () => {
    expect(CONTRIBUTION_QUERY).toContain("$since: DateTime!");
    expect(CONTRIBUTION_QUERY).toContain("$historySince: GitTimestamp!");
  });

  it("queries contributionsCollection", () => {
    expect(CONTRIBUTION_QUERY).toContain("contributionsCollection");
  });

  it("queries repositories with commit history", () => {
    expect(CONTRIBUTION_QUERY).toContain("repositories(");
    expect(CONTRIBUTION_QUERY).toContain("history(since: $historySince");
  });

  it("queries pull request contributions with additions/deletions/changedFiles", () => {
    expect(CONTRIBUTION_QUERY).toContain("pullRequestContributions");
    expect(CONTRIBUTION_QUERY).toContain("additions");
    expect(CONTRIBUTION_QUERY).toContain("deletions");
    expect(CONTRIBUTION_QUERY).toContain("changedFiles");
  });

  it("queries owned repos for watchers, forkCount, and stargazerCount", () => {
    expect(CONTRIBUTION_QUERY).toContain("stargazerCount");
    expect(CONTRIBUTION_QUERY).toContain("forkCount");
    expect(CONTRIBUTION_QUERY).toContain("watchers");
    expect(CONTRIBUTION_QUERY).toContain("totalCount");
  });
});

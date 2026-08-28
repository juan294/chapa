import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function workflow(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

/**
 * Squash-merging a release PR (develop -> main) discards shared history, so
 * main's new commit has no ancestry relationship to develop even when their
 * trees are content-identical. Left unresolved, the *next* develop -> main
 * release PR can come back CONFLICTING, which means GitHub never creates
 * refs/pull/N/merge, which means every pull_request-event check for that PR
 * -- including "Pending Migrations Check (release PR)" in ci.yml -- silently
 * never runs at all (reported as `skipped`, not failed).
 *
 * This workflow closes the gap automatically on every push to main. These
 * tests pin the properties that make it safe to leave unattended: it must
 * gate on ancestry before ever creating a commit (no-op when clean), it must
 * never push to `main` (so it can never re-trigger itself), and it must use
 * `git merge -s ours` so develop's tree is never altered by the merge.
 */
describe("auto-backmerge workflow contract", () => {
  const backmerge = workflow(".github/workflows/auto-backmerge.yml");

  it("triggers on push to main, not on a schedule or pull_request", () => {
    expect(backmerge).toMatch(/\n\s+push:\n\s+branches: \[main\]/);
    expect(backmerge).toContain("workflow_dispatch:");
    expect(backmerge).not.toMatch(/\bpull_request:/);
    expect(backmerge).not.toMatch(/\bschedule:/);
  });

  it("never pushes to main, so it cannot re-trigger itself", () => {
    expect(backmerge).not.toContain("HEAD:main");
    expect(backmerge).not.toContain(":refs/heads/main");
    expect(backmerge).toContain("git push origin HEAD:develop");
  });

  it("is a no-op when develop already has main as an ancestor", () => {
    expect(backmerge).toContain("git merge-base --is-ancestor");
    expect(backmerge).toContain("needs_merge=false");
    expect(backmerge).toContain("needs_merge=true");
    // Both the merge step and the push step must be gated on the check --
    // otherwise a clean run would still create/push an empty commit.
    const mergeStepIndex = backmerge.indexOf("Back-merge main into develop");
    const pushStepIndex = backmerge.indexOf("name: Push develop");
    const mergeStep = backmerge.slice(mergeStepIndex, pushStepIndex);
    const pushStep = backmerge.slice(pushStepIndex);
    expect(mergeStep).toContain(
      "if: steps.check.outputs.needs_merge == 'true'",
    );
    expect(pushStep).toContain(
      "if: steps.check.outputs.needs_merge == 'true'",
    );
  });

  it("preserves develop's tree byte-for-byte via the ours merge strategy", () => {
    expect(backmerge).toContain("git merge -s ours");
    expect(backmerge).toContain("origin/main");
  });

  it("requests write access explicitly, since the repo default is read-only", () => {
    expect(backmerge).toMatch(/permissions:\n\s+contents: write/);
    expect(backmerge).toContain("token: ${{ secrets.GITHUB_TOKEN }}");
  });

  it("scopes runs to the canonical repository and serializes concurrent runs", () => {
    expect(backmerge).toContain("if: github.repository == 'juan294/chapa'");
    expect(backmerge).toContain("concurrency:");
    expect(backmerge).toContain("cancel-in-progress: false");
  });

  it("checks out full history so merge-base can see the real ancestry", () => {
    expect(backmerge).toContain("fetch-depth: 0");
    expect(backmerge).toContain("ref: develop");
  });
});

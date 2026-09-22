import { afterEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { validateReleaseDocs } from "./validate-release-docs";

const roots: string[] = [];
const playbookPath = "docs/release/release-playbook.md";
const delegatedFiles = ["docs/runbooks/release-checklist.md", "docs/runbooks/deployment-smoke.md", "docs/runbooks/migrations.md", "docs/runbooks/rollback.md", "docs/runbooks/incident-response.md", "docs/runbooks/observability.md", "CLAUDE.md"];
function write(root: string, file: string, text: string) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}
function playbook() {
  return [
    "# Local qualification then separately authorized production",
    "local-candidate: exact commit and candidateTreeDigest; allowlisted build manifest; no tracked commits after qualification.",
    "Preview prevention must be proved before any push; an Ignored Build Step is insufficient.",
    'developTreeDigest="$(git rev-parse \'origin/develop^{tree}\')"',
    'prospectiveMainTreeDigest="$(git merge-tree --write-tree origin/main origin/develop)"',
    'test "$prospectiveMainTreeDigest" = "$developTreeDigest"',
    "Obtain merge authorization and migration admission using actual production credentials.",
    "gh pr merge --merge --auto",
    "Verify mainTreeDigest and production identity.",
    "Obtain tag authorization.",
    "git tag -a vX.Y.Z mainCommit",
    "gh release create",
    "gh release view",
    "pnpm release:write-result --stage final",
    "Rollback: PAUSED BLOCKED ROLLED_BACK PUBLICATION_PENDING.",
  ].join("\n");
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-docs-")); roots.push(root);
  write(root, playbookPath, playbook());
  write(root, ".claude/commands/release.md", `Read ${playbookPath}.\nversion choice; full diff approval; PR authorization; merge authorization; tag authorization.\ngh pr merge --merge --auto`);
  write(root, ".claude/commands/explore-release.md", `Read ${playbookPath}. Fixed immutable candidate; optional deep verification.`);
  write(root, ".claude/commands/prodplaybook.md", "Read docs/playbooks/e2e-pro-release-verification.md. RELEASE_VERIFICATION_MODE=deep; docs/agents/prodplaybook-report.md; BLOCKED.");
  write(root, "docs/playbooks/e2e-pro-release-verification.md", "local-candidate; deployed checks need explicit authorization.");
  for (const file of delegatedFiles) write(root, file, `Ordering: ${playbookPath}`);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("local release documentation contract", () => {
  it("accepts exact local proof with separately authorized production ordering", () => {
    expect(validateReleaseDocs(fixture())).toEqual([]);
  });
  it("accepts equality through the exact qualified candidate, but never drops the comparison", () => {
    const root = fixture();
    write(root, playbookPath, playbook().replace('test "$prospectiveMainTreeDigest" = "$developTreeDigest"', 'test "$developTreeDigest" = "$candidateTreeDigest"\ntest "$prospectiveMainTreeDigest" = "$candidateTreeDigest"'));
    expect(validateReleaseDocs(root)).toEqual([]);
    write(root, playbookPath, playbook().replace('test "$prospectiveMainTreeDigest" = "$developTreeDigest"', ""));
    expect(validateReleaseDocs(root).some(error => error.includes("prospective main tree"))).toBe(true);
  });
  it.each(["candidateTreeDigest", "exact commit", "allowlisted build manifest", "no tracked commits", "Preview prevention", "migration admission"])("rejects missing %s", phrase => {
    const root = fixture(); write(root, playbookPath, playbook().replace(phrase, "omitted"));
    expect(validateReleaseDocs(root).some(error => error.includes(phrase))).toBe(true);
  });
  it.each([
    "gh workflow run release-verification.yml",
    "vercel deploy --target preview",
    "vercel deploy",
    "vercel deploy --yes",
    "VERCEL_ENV=preview pnpm test",
    "gh run download the Preview release-result.json",
  ])("rejects active Preview qualification: %s", command => {
    const root = fixture(); write(root, playbookPath, `${playbook()}\n${command}`);
    expect(validateReleaseDocs(root).some(error => error.includes("Preview"))).toBe(true);
  });
  it("rejects migration admission after promotion", () => {
    const root = fixture(); write(root, playbookPath, playbook().replace("and migration admission", "").concat("\nmigration admission"));
    expect(validateReleaseDocs(root).some(error => error.includes("precede the promotion merge"))).toBe(true);
  });
  it("rejects tagging before production identity and full-tree equality", () => {
    const root = fixture(); write(root, playbookPath, `git tag -a early\n${playbook()}`);
    expect(validateReleaseDocs(root).some(error => error.includes("precede tag"))).toBe(true);
  });
  it("rejects final proof before publication readback", () => {
    const root = fixture(); write(root, playbookPath, playbook().replace("gh release view\npnpm release:write-result --stage final", "pnpm release:write-result --stage final\ngh release view"));
    expect(validateReleaseDocs(root).some(error => error.includes("final receipt"))).toBe(true);
  });
  it("rejects ancestry-only topology, squash promotion and subordinate mutations", () => {
    const root = fixture(); write(root, playbookPath, playbook().replace("git merge-tree --write-tree origin/main origin/develop", "git merge-base --is-ancestor origin/main origin/develop"));
    write(root, delegatedFiles[0]!, `${playbookPath}\ngh pr merge --squash\ngit tag -a early`);
    const errors = validateReleaseDocs(root);
    expect(errors.some(error => error.includes("prospective main tree"))).toBe(true);
    expect(errors.some(error => error.includes("squash"))).toBe(true);
    expect(errors.some(error => error.includes("subordinate"))).toBe(true);
  });
  it("rejects missing delegation and release mutations in verification-only commands", () => {
    const root = fixture(); write(root, ".claude/commands/release.md", "Standalone");
    write(root, ".claude/commands/prodplaybook.md", "git tag -a bad");
    const errors = validateReleaseDocs(root);
    expect(errors.some(error => error.includes("must delegate"))).toBe(true);
    expect(errors.some(error => error.includes("verification-only"))).toBe(true);
  });
  it("rejects retired machinery and an unconditional deep-verification loop", () => {
    const root = fixture(); write(root, playbookPath, `${playbook()}\nquality/release-required.json\n/explore-release candidate.json`);
    const errors = validateReleaseDocs(root);
    expect(errors.some(error => error.includes("retired"))).toBe(true);
    expect(errors.some(error => error.includes("unconditional"))).toBe(true);
  });
  it("validates the actual active repository procedure", () => {
    expect(validateReleaseDocs(path.resolve(import.meta.dirname, "../.."))).toEqual([]);
  });
});

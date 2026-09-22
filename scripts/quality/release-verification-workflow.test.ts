import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function workflow(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), "utf8");
}

describe("local release qualification has no hosted Preview workflow", () => {
  it("retires the active Preview dispatch and reusable qualifier", () => {
    expect(existsSync(resolve(repositoryRoot, ".github/workflows/release-verification.yml"))).toBe(false);
    for (const file of readdirSync(resolve(repositoryRoot, ".github/workflows")).filter(file => /\.ya?ml$/.test(file))) {
      const source = workflow(`.github/workflows/${file}`);
      expect(source).not.toMatch(/release-verification\.yml|release:verify-identity|--stage preview|RELEASE_VERIFICATION_MODE:\s*default/);
    }
  });
});

describe("producer workflow evidence contract", () => {
  const ci = workflow(".github/workflows/ci.yml");
  const nightly = workflow(".github/workflows/nightly-prod-probe.yml");

  it("no longer creates a .release-evidence directory or uploads release-evidence artifacts", () => {
    expect(ci).not.toContain(".release-evidence");
    expect(ci).not.toMatch(/release-evidence-\$\{\{/);
  });

  it("preserves current protected aggregate job names", () => {
    expect(ci).toMatch(/\n\s+name: Test\n/);
    expect(ci).toMatch(/\n\s+name: E2E Tests\n/);
    expect(ci).toMatch(/\n\s+name: Deployment Smoke\n/);
    expect(ci).toMatch(/\n\s+name: Lint & Typecheck\n/);
    expect(ci).toMatch(/\n\s+name: Contract \(real DB\)\n/);
    expect(ci).toMatch(/\n\s+name: Pending Migrations Check \(release PR\)\n/);
  });

  it("keeps the Next.js build artifact used by E2E shards", () => {
    expect(ci).toContain("nextjs-build-${{ github.run_id }}-${{ github.run_attempt }}");
    expect(ci).not.toMatch(/\n\s+name: nextjs-build\s*\n/);
  });

  it("fails the pending-migrations job closed when production read credentials are missing", () => {
    const migrationJob = ci.slice(
      ci.indexOf("pending-migrations-check:"),
    );
    expect(migrationJob).toContain("::error::");
    expect(migrationJob).toContain("exit 1");
    expect(migrationJob).not.toContain("::notice::");
    expect(migrationJob).not.toMatch(/STATUS="skipped"/);
    expect(migrationJob).toContain("pnpm run check:pending-migrations");
  });

  it("keeps nightly runner and production target identities separate", () => {
    expect(nightly).toContain("runnerCommit");
    expect(nightly).toContain("targetCommit");
    expect(nightly).toContain("targetEnvironment");
    expect(nightly).toContain("authorizationEligible: false");
    expect(nightly).toContain('environment: "production"');
    expect(nightly).toContain("nightly-production-fragment.json");
    expect(nightly).toContain("if: always()");
    expect(nightly).toContain("retention-days: 30");
  });
});

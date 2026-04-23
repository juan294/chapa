import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const agentUtilsPath = path.join(projectRoot, "scripts/lib/agent-utils.sh");

function runValidation(
  reportContent: string,
  validPattern = "^(# |```markdown)",
): { success: boolean; output: string } {
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-utils-test-"));
  const reportPath = path.join(tempDir, "report.md");
  writeFileSync(reportPath, reportContent, "utf8");

  try {
    const output = execFileSync(
      "bash",
      [
        "-lc",
        `source "${agentUtilsPath}"; validate_report_file "${reportPath}" "test-agent" '${validPattern}'`,
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
      },
    );

    return { success: true, output };
  } catch (error) {
    const output =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: string }).stderr ?? "")
        : "";

    return { success: false, output };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

afterEach(() => {
  delete process.env.CHAPA_PRODUCTION_URL;
  delete process.env.CHAPA_API_BASE;
});

describe("validate_report_file", () => {
  it("accepts markdown reports that start with a heading", () => {
    const result = runValidation("# Coverage Report\n\n## Executive Summary\nAll clear.\n");
    expect(result.success).toBe(true);
  });

  it("accepts fenced markdown reports", () => {
    const result = runValidation("```markdown\n# QA Report\n\n## Executive Summary\nAll clear.\n```");
    expect(result.success).toBe(true);
  });

  it("rejects rate-limit stub output", () => {
    const result = runValidation("You've hit your limit · resets 2am (Europe/Madrid)\n");
    expect(result.success).toBe(false);
    expect(result.output).toContain("invalid report output");
  });

  it("rejects empty report files", () => {
    const result = runValidation("");
    expect(result.success).toBe(false);
    expect(result.output).toContain("report file is empty");
  });

  it("accepts custom success markers for cc-rpi sync", () => {
    const result = runValidation(
      "cc-rpi sync: already up to date as of v1.17.2.\n",
      "^(# |```markdown|cc-rpi sync: already up to date as of )",
    );
    expect(result.success).toBe(true);
  });
});

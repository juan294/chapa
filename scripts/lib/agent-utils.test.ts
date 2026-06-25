import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const agentUtilsPath = path.join(projectRoot, "scripts/lib/agent-utils.sh");
const legacyAgentUtilsPath = path.join(
  projectRoot,
  "scripts/agents/lib/agent-utils.sh",
);

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
        // Capture stderr instead of inheriting it — these tests intentionally
        // exercise failure paths where agent-utils.sh logs [ERROR] lines.
        // Inheriting would leak that expected noise into passing test output.
        stdio: ["pipe", "pipe", "pipe"],
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

function runLockCommand(script: string): { success: boolean; output: string } {
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-utils-lock-test-"));
  const lockName = `test-lock-${process.pid}-${Date.now()}`;

  try {
    const output = execFileSync(
      "bash",
      [
        "-lc",
        `export CHAPA_AGENT_LOCK_DIR="${tempDir}"; source "${agentUtilsPath}"; LOCK_NAME="${lockName}"; ${script}`,
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        // Capture stderr instead of inheriting it — lock-timeout tests
        // intentionally trigger [ERROR] logging that would otherwise leak
        // into passing test output.
        stdio: ["pipe", "pipe", "pipe"],
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

function runSharedContextExtraction(
  reportContent: string,
  utilsPath = agentUtilsPath,
): { success: boolean; output: string } {
  const tempDir = mkdtempSync(path.join(tmpdir(), "agent-utils-shared-test-"));
  const reportPath = path.join(tempDir, "report.md");
  const sharedContextPath = path.join(tempDir, "shared-context.md");
  writeFileSync(reportPath, reportContent, "utf8");

  const sourcePrefix = utilsPath.includes("/scripts/agents/")
    ? `SCRIPT_DIR="${path.join(projectRoot, "scripts/agents")}"; `
    : "";

  try {
    const output = execFileSync(
      "bash",
      [
        "-lc",
        `${sourcePrefix}source "${utilsPath}"; SHARED_CONTEXT_FILE="${sharedContextPath}"; extract_and_write_shared_context "coverage_agent" "${reportPath}"; test -f "${sharedContextPath}" && cat "${sharedContextPath}" || true`,
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
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
  delete process.env.CHAPA_AGENT_LOCK_DIR;
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

describe("agent locks", () => {
  it("acquires and releases named locks", () => {
    const result = runLockCommand(
      'acquire_agent_lock "${LOCK_NAME}" "test-agent" 1; test -d "${CHAPA_AGENT_LOCK_DIR}/${LOCK_NAME}"; release_agent_lock "${LOCK_NAME}"; test ! -e "${CHAPA_AGENT_LOCK_DIR}/${LOCK_NAME}"',
    );

    expect(result.success).toBe(true);
  });

  it("times out when a named lock is already held", () => {
    const result = runLockCommand(
      'mkdir "${CHAPA_AGENT_LOCK_DIR}/${LOCK_NAME}"; acquire_agent_lock "${LOCK_NAME}" "test-agent" 0',
    );

    expect(result.success).toBe(false);
    expect(result.output).toContain("Timed out waiting for test-agent lock");
  });
});

describe("extract_and_write_shared_context", () => {
  it("extracts HTML-comment shared context markers without exiting nonzero", () => {
    for (const utilsPath of [agentUtilsPath, legacyAgentUtilsPath]) {
      const result = runSharedContextExtraction(
        `# Coverage Report

<!-- SHARED_CONTEXT_START -->
- Tests: 7977/7977 passed
<!-- SHARED_CONTEXT_END -->
`,
        utilsPath,
      );

      expect(result.success, utilsPath).toBe(true);
      expect(result.output).toContain("agent=coverage_agent");
      expect(result.output).toContain("- Tests: 7977/7977 passed");
    }
  });

  it("treats missing shared context as a non-fatal condition", () => {
    for (const utilsPath of [agentUtilsPath, legacyAgentUtilsPath]) {
      const result = runSharedContextExtraction(
        "# Coverage Report\n\nNo cross-agent context today.\n",
        utilsPath,
      );

      expect(result.success, utilsPath).toBe(true);
      expect(result.output).not.toContain("agent=coverage_agent");
    }
  });
});

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..");
const agentUtils = path.join(projectRoot, "scripts/lib/agent-utils.sh");
const tempDirs: string[] = [];

function tempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "chapa-report-safety-"));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("scheduled agent report publication", () => {
  it("preserves the last good report when validation rejects new output", () => {
    const directory = tempDir();
    const report = path.join(directory, "report.md");
    writeFileSync(report, "# Last good report\n");

    execFileSync(
      "bash",
      [
        "-s",
        "--",
        agentUtils,
        report,
      ],
      {
        input: `source "$1"
temp_file=$(create_report_temp "$2")
printf "%s\\n" "You've hit your limit" > "$temp_file"
if publish_report_file "$temp_file" "$2" "test-agent"; then
  exit 2
fi
rm -f "$temp_file"`,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    expect(readFileSync(report, "utf8")).toBe("# Last good report\n");
  });

  it("atomically publishes valid output beside the destination", () => {
    const directory = tempDir();
    const report = path.join(directory, "report.md");
    writeFileSync(report, "# Old report\n");

    execFileSync(
      "bash",
      [
        "-s",
        "--",
        agentUtils,
        report,
      ],
      {
        input: `source "$1"
temp_file=$(create_report_temp "$2")
printf "%s\\n" "# New report" > "$temp_file"
publish_report_file "$temp_file" "$2" "test-agent"`,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    expect(readFileSync(report, "utf8")).toBe("# New report\n");
  });

  it.each([
    "coverage-agent.sh",
    "security-agent.sh",
    "performance-agent.sh",
    "qa-agent.sh",
    "documentation-agent.sh",
    "cost-analyst.sh",
  ])("%s uses the shared publication path", (name) => {
    const script = readFileSync(path.join(projectRoot, "scripts", name), "utf8");
    expect(script).toContain("create_report_temp");
    expect(script).toContain("publish_report_file");
  });

  it("cc-rpi-update uses shared publication with its custom report pattern", () => {
    const script = readFileSync(
      path.join(projectRoot, "scripts/cc-rpi-update.sh"),
      "utf8",
    );
    expect(script).toContain("create_report_temp");
    expect(script).toContain("publish_report_file");
    expect(script).toContain("cc-rpi sync: already up to date as of");
  });
});

import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("validate-migrations CLI", () => {
  it("runs successfully via the repo-supported Node entrypoint", async () => {
    const scriptPath = resolve(__dirname, "validate-migrations.ts");
    const repoRoot = resolve(__dirname, "..");

    const result = await execFileAsync("node", [scriptPath], {
      cwd: repoRoot,
    });

    expect(result.stdout).toContain("All");
    expect(result.stdout).toContain("migrations valid");
  });
});

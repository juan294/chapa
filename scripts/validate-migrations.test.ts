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

    // Run through the repo-supported TS runtime (tsx), exactly like the
    // `validate:migrations` package script. Bare `node file.ts` only executes
    // TypeScript on Node >=22 (native type stripping); CI pins Node 20, where
    // it throws ERR_UNKNOWN_FILE_EXTENSION. `node --import tsx` is the
    // node-entrypoint form that works on the pinned runtime.
    const result = await execFileAsync("node", ["--import", "tsx", scriptPath], {
      cwd: repoRoot,
    });

    expect(result.stdout).toContain("All");
    expect(result.stdout).toContain("migrations valid");
  });
});

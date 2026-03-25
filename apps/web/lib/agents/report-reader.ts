/**
 * Filesystem helpers for reading agent report files.
 *
 * Isolated into a separate module so that the dynamic `process.cwd()` usage
 * does not cause Turbopack NFT (Node File Trace) to over-trace the entire
 * project tree when bundling the agents-summary API route.
 *
 * The `turbopackIgnore` inline comments tell NFT to skip static resolution
 * of the filesystem and path calls, preventing it from walking the project
 * directory.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export interface ReportFileResult {
  content: string | null;
  lastRun: string | null;
}

/**
 * Read an agent report file relative to the project root.
 *
 * Returns `{ content, lastRun }` on success, or `{ null, null }` when the
 * file does not exist.
 */
export async function readReportFile(
  relativePath: string,
): Promise<ReportFileResult> {
  const filePath = join(/* turbopackIgnore: true */ process.cwd(), relativePath);
  try {
    const fileStat = await stat(/* turbopackIgnore: true */ filePath);
    const content = await readFile(/* turbopackIgnore: true */ filePath, "utf-8");
    return { content, lastRun: fileStat.mtime.toISOString() };
  } catch {
    return { content: null, lastRun: null };
  }
}

/**
 * Read the shared-context markdown file used for cross-agent intelligence.
 *
 * Returns the file contents as a string, or `null` when the file does not
 * exist.
 */
export async function readSharedContext(): Promise<string | null> {
  const filePath = join(/* turbopackIgnore: true */ process.cwd(), "docs/agents/shared-context.md");
  try {
    return await readFile(/* turbopackIgnore: true */ filePath, "utf-8");
  } catch {
    return null;
  }
}

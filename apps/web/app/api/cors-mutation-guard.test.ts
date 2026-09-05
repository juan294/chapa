/**
 * Mechanical guard against accidentally shipping wildcard CORS on a mutation
 * handler. The two read-only endpoints (`/api/verify/[hash]` + `/api/profile/[handle]`)
 * intentionally expose `Access-Control-Allow-Origin: *` because they're meant
 * to be embedded cross-origin. Any other handler that ships POST/PUT/PATCH/DELETE
 * with a wildcard origin would expose mutating endpoints to the entire web —
 * this test fails the build before that can happen. The v7 verification POST
 * compares submitted bytes without persisting them; its exact method/path is exempt.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const API_ROOT = path.resolve(__dirname);
const MUTATION_EXPORT_PATTERN =
  /export\s+(?:async\s+function|const|function)\s+(POST|PUT|PATCH|DELETE)\b/g;
function hasMutationExport(source: string, route: string): boolean {
  return [...source.matchAll(MUTATION_EXPORT_PATTERN)].some((match) =>
    !(route === "verify/[hash]/route.ts" && match[1] === "POST"));
}
const FORBIDDEN_CORS_PATTERN = /Access-Control-Allow-Origin\s*"?\s*[:=]\s*"?\s*\*/i;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

describe("CORS guard for mutation handlers", () => {
  it("exempts only the read-only receipt comparison method and path", () => {
    expect(hasMutationExport("export const POST = compare", "verify/[hash]/route.ts")).toBe(false);
    expect(hasMutationExport("export const POST = save", "other/route.ts")).toBe(true);
    expect(hasMutationExport("export const POST = compare; export async function DELETE() {}", "verify/[hash]/route.ts")).toBe(true);
    expect(hasMutationExport("export const PUT = save", "verify/[hash]/route.ts")).toBe(true);
  });
  it("no mutation route exports POST/PUT/PATCH/DELETE alongside a wildcard CORS origin", async () => {
    const routeFiles = await walk(API_ROOT);
    const offenders: string[] = [];

    for (const file of routeFiles) {
      const source = await fs.readFile(file, "utf8");
      if (!hasMutationExport(source, path.relative(API_ROOT, file))) continue;
      if (FORBIDDEN_CORS_PATTERN.test(source)) {
        offenders.push(path.relative(API_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

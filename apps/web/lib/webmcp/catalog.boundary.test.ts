import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEBMCP_DIR = resolve(__dirname);
const SERVER_SAFE_ROOTS = ["catalog.ts", "shared-tools.ts", "errors.ts"];

function resolveRelativeImport(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts")];
  const match = candidates.find(existsSync);
  if (!match) {
    throw new Error(`Cannot resolve ${specifier} imported by ${fromFile}`);
  }
  return match;
}

function relativeImports(source: string): string[] {
  return Array.from(
    source.matchAll(/\b(?:import|export)\s+(?:[^"']+\s+from\s+)?["'](\.[^"']+)["']/g),
  ).flatMap((match) => match[1] ? [match[1]] : []);
}

function collectServerSafeGraph(): Map<string, string> {
  const pending = SERVER_SAFE_ROOTS.map((file) => resolve(WEBMCP_DIR, file));
  const sources = new Map<string, string>();

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || sources.has(file)) continue;

    const source = readFileSync(file, "utf8");
    sources.set(file, source);
    for (const specifier of relativeImports(source)) {
      pending.push(resolveRelativeImport(file, specifier));
    }
  }

  return sources;
}

describe("the server-safe WebMCP catalog boundary", () => {
  it("contains no client modules in its relative import graph", () => {
    const offenders = Array.from(collectServerSafeGraph())
      .filter(([, source]) => /^\s*["']use client["'];/m.test(source))
      .map(([file]) => relative(WEBMCP_DIR, file));

    expect(offenders).toEqual([]);
  });

  it("keeps shared tools independent from the registration adapter", () => {
    const source = readFileSync(resolve(WEBMCP_DIR, "shared-tools.ts"), "utf8");

    expect(source).not.toContain("use-model-context-tools");
  });
});

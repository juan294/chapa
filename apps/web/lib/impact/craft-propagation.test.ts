import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Craft propagation consistency test (#680).
 *
 * Three v2.7.x bugs shipped to production because no test verified the
 * invariant: "every call to computeImpactV6 must pass craft as the second
 * argument when insights exist for that handle."
 *
 * v2.7.2 in particular shipped because /api/refresh/route.ts called
 * `computeImpactV6(stats)` without craft. All 6,955 unit tests passed because
 * each route was tested in isolation with mocked impact compute.
 *
 * This test scans the entire non-test source tree for call sites of
 * computeImpactV6 and asserts every call passes a second argument (craft),
 * OR is explicitly listed in CRAFT_OPTOUTS below with a justification.
 *
 * If a new opt-out is added to this list, it must come with a written
 * justification in the comment.
 */

// ---------------------------------------------------------------------------
// Documented exception list
// ---------------------------------------------------------------------------
//
// Each entry MUST be a relative path from the repo root (with forward slashes
// on all OSes) AND must come with a justification in the trailing comment.
//
// REVIEW: as of #680 these two call sites compute impact without craft, even
// though the user may have insights. They are documented here so the test does
// not regress further; whether they should pass craft is being tracked
// separately. Both are non-user-visible / non-persistent paths:
//   - /api/generate: warms the badge cache and discards the result; the badge
//     route itself reads craft from cache via materializeProfile.
//   - /studio/page.tsx: renders a customization preview for the badge owner
//     based on their own GitHub stats. Insights come through the cached path
//     once the user visits /u/<handle>.
//
const CRAFT_OPTOUTS: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "apps/web/app/api/generate/route.ts",
    reason:
      "Cache warm only: result is discarded; user-visible badge reads craft via materializeProfile.",
  },
  {
    file: "apps/web/app/studio/page.tsx",
    reason:
      "Studio preview computes a same-day display from primary stats; share page is the source of truth.",
  },
];

// Node-style path filter: skip directories that never contain runtime code.
const SKIP_DIRS = new Set<string>([
  "node_modules",
  "node_modules.nosync",
  ".next",
  ".turbo",
  ".git",
  ".worktrees",
  "coverage",
  "dist",
  "build",
  "playwright-report",
  "test-results",
  "logs",
]);

const SOURCE_ROOTS = ["apps", "packages"] as const;

// REPO_ROOT is the top-level chapa workspace, regardless of whether the test
// runs from the main worktree or a worktree under .worktrees/.
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function listFilesRecursive(rootAbs: string): string[] {
  const out: string[] = [];
  const stack = [rootAbs];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const abs = path.join(dir, entry);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(abs);
      } else if (st.isFile()) {
        out.push(abs);
      }
    }
  }
  return out;
}

function isRuntimeSourceFile(absPath: string): boolean {
  if (!/\.(ts|tsx)$/.test(absPath)) return false;
  if (/\.test\.(ts|tsx)$/.test(absPath)) return false;
  if (/\.d\.ts$/.test(absPath)) return false;
  // Skip script files that emit code analysis utilities themselves.
  // The CI grep guard script is allowed to mention computeImpactV6 inside
  // strings, but it lives under scripts/ which is outside SOURCE_ROOTS.
  return true;
}

interface CallSite {
  file: string; // relative to REPO_ROOT, forward slashes
  line: number;
  argSnippet: string; // raw argument list contents
  hasCraftArg: boolean;
}

/**
 * Find every `computeImpactV6(...)` call site in the file. Captures the
 * argument list (text between the matching parens) so we can determine
 * whether a second argument was passed.
 *
 * This is intentionally a string scan (not a TypeScript AST parse) for two
 * reasons:
 *   1. It can run as a CI shell step with no Node/TS tooling.
 *   2. It mirrors what the CI grep guard script does, so the two stay aligned.
 */
function findCallSites(absPath: string, relPath: string): CallSite[] {
  const src = readFileSync(absPath, "utf8");
  const sites: CallSite[] = [];
  // Match a call expression where computeImpactV6 is invoked. Skip
  // declarations / imports by requiring "(" immediately after the identifier
  // boundary and disallowing "function" or "import" tokens before.
  const callRe = /\bcomputeImpactV6\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 1; // position of "("
    // Skip the function declaration itself (in v6.ts).
    const before = src.slice(Math.max(0, m.index - 32), m.index);
    if (
      /\bfunction\s+$/.test(before) ||
      /\bexport\s+function\s+$/.test(before)
    ) {
      continue;
    }

    // Walk forward to the matching ")", accounting for nested parens, strings,
    // and template literals. This is a simplified balanced-paren walker — good
    // enough for our codebase's call patterns.
    let depth = 1;
    let i = openIdx + 1;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    while (i < src.length && depth > 0) {
      const c = src[i];
      const prev = src[i - 1];
      if (inSingle) {
        if (c === "'" && prev !== "\\") inSingle = false;
      } else if (inDouble) {
        if (c === '"' && prev !== "\\") inDouble = false;
      } else if (inTemplate) {
        if (c === "`" && prev !== "\\") inTemplate = false;
      } else if (c === "'") {
        inSingle = true;
      } else if (c === '"') {
        inDouble = true;
      } else if (c === "`") {
        inTemplate = true;
      } else if (c === "(") {
        depth += 1;
      } else if (c === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      i += 1;
    }
    if (depth !== 0) continue; // unmatched, skip
    const inner = src.slice(openIdx + 1, i);
    const lineNumber = src.slice(0, m.index).split("\n").length;
    sites.push({
      file: relPath,
      line: lineNumber,
      argSnippet: inner.trim(),
      hasCraftArg: hasSecondArg(inner),
    });
  }
  return sites;
}

/**
 * Decide whether the argument list contains at least one comma at top
 * nesting depth, indicating a second argument was supplied.
 */
function hasSecondArg(args: string): boolean {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = 0; i < args.length; i += 1) {
    const c = args[i];
    const prev = args[i - 1];
    if (inSingle) {
      if (c === "'" && prev !== "\\") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (c === '"' && prev !== "\\") inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (c === "`" && prev !== "\\") inTemplate = false;
      continue;
    }
    if (c === "'") inSingle = true;
    else if (c === '"') inDouble = true;
    else if (c === "`") inTemplate = true;
    else if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth -= 1;
    else if (c === "," && depth === 0) return true;
  }
  return false;
}

function collectCallSites(): CallSite[] {
  const all: CallSite[] = [];
  for (const root of SOURCE_ROOTS) {
    const rootAbs = path.join(REPO_ROOT, root);
    const files = listFilesRecursive(rootAbs).filter(isRuntimeSourceFile);
    for (const abs of files) {
      const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
      const sites = findCallSites(abs, rel);
      all.push(...sites);
    }
  }
  return all;
}

describe("computeImpactV6 craft propagation invariant (#680)", () => {
  const sites = collectCallSites();

  it("scans the codebase and finds at least one call site (sanity check)", () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it("every call site either passes craft or is on the documented opt-out list", () => {
    const optoutFiles = new Set(CRAFT_OPTOUTS.map((e) => e.file));
    const offenders: string[] = [];
    for (const site of sites) {
      if (site.hasCraftArg) continue;
      if (optoutFiles.has(site.file)) continue;
      offenders.push(
        `${site.file}:${site.line} — computeImpactV6(${site.argSnippet}) is missing the craft argument. ` +
          `This was the v2.7.2 production bug. Pass the craft score, or add an entry to CRAFT_OPTOUTS in ` +
          `apps/web/lib/impact/craft-propagation.test.ts with a written justification.`,
      );
    }
    expect(
      offenders,
      `Found ${offenders.length} call site(s) of computeImpactV6 without craft:\n  - ${offenders.join("\n  - ")}`,
    ).toEqual([]);
  });

  it("every documented opt-out still exists in the codebase (otherwise prune the list)", () => {
    const filesWithCalls = new Set(sites.map((s) => s.file));
    const stale: string[] = [];
    for (const entry of CRAFT_OPTOUTS) {
      if (!filesWithCalls.has(entry.file)) {
        stale.push(entry.file);
      }
    }
    expect(
      stale,
      `Stale entries in CRAFT_OPTOUTS — these files no longer call computeImpactV6: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("every documented opt-out has a non-empty justification", () => {
    const missing = CRAFT_OPTOUTS.filter((e) => !e.reason || e.reason.trim().length < 16);
    expect(
      missing.map((e) => e.file),
      `Opt-out entries must explain why craft is intentionally omitted (>=16 chars).`,
    ).toEqual([]);
  });
});

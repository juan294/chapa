import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const APP_DIR = resolve(__dirname, "../app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function importsShell(file: string): boolean {
  return readFileSync(file, "utf8")
    .split("\n")
    .some(
      (line) => /^\s*import\b/.test(line) && /DynamicRouteShell/.test(line),
    );
}

/**
 * #1194 / FE-S1 — the load-bearing half of this refactor.
 *
 * `DynamicRouteShell` reads request state (session via `headers()`, and the
 * resolved locale). The 13 content pages under `app/[locale]/` are statically
 * generated at build time for BOTH locales, which is what makes them CDN
 * cacheable and is the entire point of the #982/#1023 work. A single import of
 * this component into one of them would silently convert that page to dynamic
 * rendering — no error, no warning, just a cache that stops working.
 *
 * `NavbarClient` exists precisely so those pages can render navigation without
 * touching `headers()` (#1025). That two-variant split is deliberate, not
 * accidental, and this test is what keeps it deliberate.
 */
describe("DynamicRouteShell stays out of statically generated routes (#1194)", () => {
  const appFiles = walk(APP_DIR);

  it("finds the app directory to scan", () => {
    expect(appFiles.length).toBeGreaterThan(20);
  });

  it("is imported by no file under app/[locale]/", () => {
    const offenders = appFiles
      .filter((f) => f.includes("/app/[locale]/"))
      .filter(importsShell)
      .map((f) => f.slice(f.indexOf("/app/")));
    expect(offenders).toEqual([]);
  });

  it("is imported by no layout — a layout wraps static children too", () => {
    const offenders = appFiles
      .filter((f) => /\/layout\.tsx$/.test(f))
      .filter(importsShell)
      .map((f) => f.slice(f.indexOf("/app/")));
    expect(offenders).toEqual([]);
  });

  // The complementary half: the dynamic routes should actually use it, so the
  // per-page hand-assembly this replaced cannot creep back.
  it.each([
    "u/[handle]/page.tsx",
    "verify/[hash]/page.tsx",
    "settings/page.tsx",
    "studio/page.tsx",
    "admin/page.tsx",
  ])("is used by the dynamic route %s", (relative) => {
    expect(importsShell(join(APP_DIR, relative))).toBe(true);
  });

  it("keeps its own locale corrections together", () => {
    const source = readFileSync(
      resolve(__dirname, "DynamicRouteShell.tsx"),
      "utf8",
    );
    expect(source).toContain("DocumentLocaleMarker");
    expect(source).toContain("LanguageProvider");
    expect(source).toContain("<Navbar");
  });

  // #1201 — the non-default branch must be derived from `locale`. A bare `en`
  // was correct only while the default locale was Spanish.
  it("derives the dictionary from the locale rather than hardcoding one", () => {
    const source = readFileSync(
      resolve(__dirname, "DynamicRouteShell.tsx"),
      "utf8",
    );
    expect(source).toContain('locale === "es" ? es : en');
  });
});

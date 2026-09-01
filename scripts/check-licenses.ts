#!/usr/bin/env node
/**
 * License-compliance gate (#1012).
 *
 * `license-checker` (the tool the CI job previously used) reads only the
 * top-level `dependencies` field of a package.json and does not follow
 * pnpm's symlinked/virtual-store `node_modules` layout into transitive
 * dependencies. Under pnpm, `apps/web/node_modules/<pkg>` is a symlink into
 * the root `node_modules/.pnpm` content store, and packages do not nest
 * their own dependencies inside their own `node_modules` folder the way
 * npm's classic layout does -- so `license-checker`'s directory walk only
 * ever discovered the ~16 direct dependencies of `apps/web`, silently
 * skipping the ~90 transitive packages that ship in the production bundle
 * (including known copyleft-adjacent packages like `@resvg/resvg-js`
 * (MPL-2.0) and `@img/sharp-libvips-darwin-arm64` (LGPL-3.0-or-later) that
 * are already documented in docs/accepted-risks.md).
 *
 * `pnpm licenses list` is pnpm's own license reporter -- it understands the
 * real dependency graph pnpm resolved, so it correctly surfaces every
 * production package. It has no allow/deny gating built in, so this script
 * adds that: it allowlists the project's stated license policy (MIT,
 * Apache-2.0, BSD, ISC, plus a small set of equally-permissive public-domain
 * style licenses) and fails the job for anything else, unless the package is
 * an explicitly documented exception (see docs/accepted-risks.md).
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface PnpmLicensePackage {
  name: string;
  versions?: string[];
  version?: string;
  license: string;
  [key: string]: unknown;
}

export type PnpmLicenseReport = Record<string, PnpmLicensePackage[]>;

export interface LicenseViolation {
  license: string;
  name: string;
  version: string;
}

export interface ExcludedPackage {
  /** Package name, e.g. "@resvg/resvg-js". */
  name: string;
  /** Specific version to exclude. Omit to exclude every version of the package. */
  version?: string;
}

export const DEFAULT_ALLOWED_LICENSES: readonly string[] = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
];

/**
 * Documented exceptions -- see docs/accepted-risks.md for the rationale
 * behind each entry. Keep this list in sync with that file: every entry
 * here must have a matching accepted-risk writeup, and every accepted-risk
 * license exception must appear here.
 */
export const DEFAULT_EXCLUDED_PACKAGES: readonly ExcludedPackage[] = [
  // MPL-2.0 -- accepted-risks.md "MPL-2.0 dependency (@resvg/resvg-js) (#464, #596)"
  // pnpm resolves a platform-specific optional binary package alongside the
  // base package; darwin-arm64 covers local macOS dev, linux-x64-gnu covers
  // the GitHub Actions Ubuntu runner CI actually installs on.
  { name: "@resvg/resvg-js" },
  { name: "@resvg/resvg-js-darwin-arm64" },
  { name: "@resvg/resvg-js-linux-x64-gnu" },
  // LGPL-3.0-or-later, dynamically linked -- accepted-risks.md
  // "LGPL-3.0 dependency (@img/sharp-libvips-darwin-arm64) (#676)". Same
  // platform-binary split as resvg-js above.
  { name: "@img/sharp-libvips-darwin-arm64" },
  { name: "@img/sharp-libvips-linux-x64" },
  // Unlicense (public domain) -- accepted-risks.md
  // "Unlicense dependency (fast-sha256) (#1012)"
  { name: "fast-sha256" },
  // MIT-0 (MIT, no-attribution) -- accepted-risks.md
  // "MIT-0 dependency (postal-mime) (#1012)"
  { name: "postal-mime" },
  // CC-BY-4.0 (browser-support data, not code) -- accepted-risks.md
  // "CC-BY-4.0 dependency (caniuse-lite) (#1012)"
  { name: "caniuse-lite" },
];

function licenseSatisfiesAllowlist(license: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(license)) return true;

  // Compound SPDX expressions carry the two operators in opposite directions,
  // so each needs its own rule:
  //
  //   OR  ("(MPL-2.0 OR Apache-2.0)")  -- the consumer picks one, so ANY
  //       allowed alternative satisfies the policy.
  //   AND ("(Apache-2.0 AND MIT)")     -- the consumer is bound by all of
  //       them, so EVERY term must be allowed.
  //
  // AND binds tighter than OR in SPDX, so split on OR first and evaluate each
  // alternative's AND terms within it.
  const trimmed = license.replace(/^\(|\)$/g, "").trim();
  const alternatives = trimmed.split(/\s+OR\s+/i);

  return alternatives.some((alternative) => {
    const terms = alternative.split(/\s+AND\s+/i);
    return terms.every((term) => allowed.has(term.trim().replace(/^\(|\)$/g, "")));
  });
}

function isExcluded(
  name: string,
  version: string,
  excluded: readonly ExcludedPackage[],
): boolean {
  return excluded.some(
    (ex) => ex.name === name && (ex.version === undefined || ex.version === version),
  );
}

export function findLicenseViolations(
  report: PnpmLicenseReport,
  options: { allowed?: readonly string[]; excluded?: readonly ExcludedPackage[] } = {},
): LicenseViolation[] {
  const allowed = new Set(options.allowed ?? DEFAULT_ALLOWED_LICENSES);
  const excluded = options.excluded ?? DEFAULT_EXCLUDED_PACKAGES;
  const violations: LicenseViolation[] = [];

  for (const [license, packages] of Object.entries(report)) {
    if (licenseSatisfiesAllowlist(license, allowed)) continue;

    for (const pkg of packages) {
      const versions = pkg.versions ?? (pkg.version ? [pkg.version] : ["unknown"]);
      for (const version of versions) {
        if (isExcluded(pkg.name, version, excluded)) continue;
        violations.push({ license, name: pkg.name, version });
      }
    }
  }

  return violations;
}

function countPackages(report: PnpmLicenseReport): number {
  return Object.values(report).reduce((sum, pkgs) => sum + pkgs.length, 0);
}

function main(): void {
  const filter = process.env.LICENSE_CHECK_FILTER ?? "@chapa/web";
  const json = execSync(`pnpm --filter ${filter} licenses list --prod --json`, {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const report: PnpmLicenseReport = JSON.parse(json);
  const violations = findLicenseViolations(report);

  if (violations.length > 0) {
    console.error(
      `License policy violation: found ${violations.length} production package(s) with a license outside the allowlist (${DEFAULT_ALLOWED_LICENSES.join(", ")}):\n`,
    );
    for (const v of violations) {
      console.error(`  - ${v.name}@${v.version}: ${v.license}`);
    }
    console.error(
      "\nIf this is an intentional, already-evaluated exception, add it to DEFAULT_EXCLUDED_PACKAGES " +
        "in scripts/check-licenses.ts and document the rationale in docs/accepted-risks.md. " +
        "Otherwise, remove or replace the dependency.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `License check passed: ${countPackages(report)} production package(s) scanned, all licenses allowed or explicitly documented as accepted risks.`,
  );
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}

#!/usr/bin/env node
/**
 * Vulnerability gate (#1008).
 *
 * The previous CI step, `pnpm audit --prod`, always failed: npm retired the
 * legacy audit endpoint (`/-/npm/v1/security/audits`) it depends on, which
 * now returns HTTP 410 for every run regardless of whether the lockfile
 * actually has vulnerable packages. That means the gate scanned zero
 * packages while still going red on every push -- worse than having no gate,
 * since a permanently-red required check trains everyone to ignore it.
 *
 * This script shells out to `osv-scanner` (installed as a standalone binary
 * in CI -- see .github/workflows/security.yml) against the pnpm lockfile,
 * which correctly walks the full dependency graph OSV.dev knows about, then
 * applies a severity + fixability threshold: only HIGH/CRITICAL
 * vulnerabilities that have a published fix fail the build. Lower-severity
 * or currently-unfixable advisories are printed for visibility but do not
 * block -- otherwise the gate becomes noisy on unfixable transitive
 * advisories and gets ignored the same way the old one was.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export interface OsvRangeEvent {
  introduced?: string;
  fixed?: string;
  limit?: string;
  last_affected?: string;
}

export interface OsvRange {
  type: string;
  events: OsvRangeEvent[];
}

export interface OsvAffected {
  ranges?: OsvRange[];
  [key: string]: unknown;
}

export interface OsvVulnerability {
  id: string;
  database_specific?: { severity?: string; [key: string]: unknown };
  affected?: OsvAffected[];
  [key: string]: unknown;
}

export interface OsvGroup {
  ids: string[];
  max_severity?: string;
  [key: string]: unknown;
}

export interface OsvPackage {
  package: { name: string; version: string; ecosystem?: string };
  vulnerabilities?: OsvVulnerability[];
  groups?: OsvGroup[];
}

export interface OsvResultSource {
  source?: { path?: string; type?: string };
  packages?: OsvPackage[];
}

export interface OsvScanReport {
  results?: OsvResultSource[];
}

export type SeverityLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";

export interface VulnerabilityFinding {
  packageName: string;
  packageVersion: string;
  vulnerabilityId: string;
  severity: SeverityLevel;
  hasFix: boolean;
}

const BLOCKING_SEVERITIES: ReadonlySet<SeverityLevel> = new Set(["HIGH", "CRITICAL"]);

function severityFromCvssScore(score: string | undefined): SeverityLevel {
  if (!score) return "UNKNOWN";
  const numeric = Number.parseFloat(score);
  if (Number.isNaN(numeric)) return "UNKNOWN";
  if (numeric >= 9.0) return "CRITICAL";
  if (numeric >= 7.0) return "HIGH";
  if (numeric >= 4.0) return "MODERATE";
  if (numeric > 0) return "LOW";
  return "UNKNOWN";
}

function normalizeSeverityWord(value: string | undefined): SeverityLevel | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper === "LOW" || upper === "MODERATE" || upper === "HIGH" || upper === "CRITICAL") {
    return upper;
  }
  return undefined;
}

function resolveSeverity(
  vuln: OsvVulnerability,
  groupsById: Map<string, OsvGroup>,
): SeverityLevel {
  const fromDatabase = normalizeSeverityWord(vuln.database_specific?.severity);
  if (fromDatabase) return fromDatabase;

  const group = groupsById.get(vuln.id);
  return severityFromCvssScore(group?.max_severity);
}

function vulnerabilityHasFix(vuln: OsvVulnerability): boolean {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      if (range.events?.some((event) => Boolean(event.fixed))) {
        return true;
      }
    }
  }
  return false;
}

export function classifyVulnerabilities(report: OsvScanReport): {
  blocking: VulnerabilityFinding[];
  informational: VulnerabilityFinding[];
} {
  const blocking: VulnerabilityFinding[] = [];
  const informational: VulnerabilityFinding[] = [];

  for (const source of report.results ?? []) {
    for (const pkg of source.packages ?? []) {
      const groupsById = new Map<string, OsvGroup>();
      for (const group of pkg.groups ?? []) {
        for (const id of group.ids) {
          groupsById.set(id, group);
        }
      }

      for (const vuln of pkg.vulnerabilities ?? []) {
        const finding: VulnerabilityFinding = {
          packageName: pkg.package.name,
          packageVersion: pkg.package.version,
          vulnerabilityId: vuln.id,
          severity: resolveSeverity(vuln, groupsById),
          hasFix: vulnerabilityHasFix(vuln),
        };

        if (BLOCKING_SEVERITIES.has(finding.severity) && finding.hasFix) {
          blocking.push(finding);
        } else {
          informational.push(finding);
        }
      }
    }
  }

  return { blocking, informational };
}

function printFindings(label: string, findings: VulnerabilityFinding[]): void {
  console.log(`\n${label} (${findings.length}):`);
  for (const f of findings) {
    console.log(
      `  - ${f.packageName}@${f.packageVersion}: ${f.vulnerabilityId} [${f.severity}]${f.hasFix ? " (fix available)" : " (no fix available yet)"}`,
    );
  }
}

function runOsvScanner(lockfile: string): string {
  try {
    return execFileSync("osv-scanner", ["scan", "source", `--lockfile=${lockfile}`, "--format", "json"], {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    // osv-scanner exits non-zero when it finds ANY vulnerability (even LOW
    // severity). We do our own severity/fix gating below, so recover stdout
    // from the error rather than letting the non-zero exit abort the check.
    const execError = error as { stdout?: string; status?: number };
    if (typeof execError.stdout === "string" && execError.stdout.length > 0) {
      return execError.stdout;
    }
    throw error;
  }
}

function main(): void {
  const lockfile = process.argv[2] ?? "pnpm-lock.yaml";
  const json = runOsvScanner(lockfile);
  const report: OsvScanReport = JSON.parse(json);
  const { blocking, informational } = classifyVulnerabilities(report);

  if (informational.length > 0) {
    printFindings("Non-blocking findings (low/moderate severity, or no fix available yet)", informational);
  }

  if (blocking.length > 0) {
    printFindings("BLOCKING findings (high/critical severity with a published fix)", blocking);
    console.error(
      "\nVulnerability gate failed: fix the packages above (e.g. `pnpm update <pkg>`), " +
        "or document an accepted risk in docs/accepted-risks.md if the fix genuinely cannot be applied yet.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nVulnerability gate passed: no high/critical vulnerabilities with an available fix.");
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}

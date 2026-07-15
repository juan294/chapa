import { describe, expect, it } from "vitest";
import {
  classifyVulnerabilities,
  type OsvScanReport,
} from "./check-vulnerabilities";

function makeReport(overrides: Partial<OsvScanReport> = {}): OsvScanReport {
  return { results: [], ...overrides };
}

describe("classifyVulnerabilities", () => {
  it("returns no findings for a clean scan", () => {
    const report = makeReport();
    const { blocking, informational } = classifyVulnerabilities(report);
    expect(blocking).toEqual([]);
    expect(informational).toEqual([]);
  });

  it("blocks a HIGH severity vulnerability that has a published fix", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "minimist", version: "0.0.8" },
              vulnerabilities: [
                {
                  id: "GHSA-vh95-rmgr-6w4m",
                  database_specific: { severity: "HIGH" },
                  affected: [
                    { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.2.6" }] }] },
                  ],
                },
              ],
              groups: [{ ids: ["GHSA-vh95-rmgr-6w4m"], max_severity: "7.5" }],
            },
          ],
        },
      ],
    };

    const { blocking, informational } = classifyVulnerabilities(report);
    expect(blocking).toEqual([
      {
        packageName: "minimist",
        packageVersion: "0.0.8",
        vulnerabilityId: "GHSA-vh95-rmgr-6w4m",
        severity: "HIGH",
        hasFix: true,
      },
    ]);
    expect(informational).toEqual([]);
  });

  it("does not block a HIGH severity vulnerability with no published fix", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "leftpad-fork", version: "1.0.0" },
              vulnerabilities: [
                {
                  id: "GHSA-unfixable",
                  database_specific: { severity: "HIGH" },
                  affected: [{ ranges: [{ type: "SEMVER", events: [{ introduced: "0" }] }] }],
                },
              ],
              groups: [{ ids: ["GHSA-unfixable"], max_severity: "7.5" }],
            },
          ],
        },
      ],
    };

    const { blocking, informational } = classifyVulnerabilities(report);
    expect(blocking).toEqual([]);
    expect(informational).toEqual([
      {
        packageName: "leftpad-fork",
        packageVersion: "1.0.0",
        vulnerabilityId: "GHSA-unfixable",
        severity: "HIGH",
        hasFix: false,
      },
    ]);
  });

  it("does not block a MODERATE severity vulnerability even with a fix available", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "lodash", version: "4.17.4" },
              vulnerabilities: [
                {
                  id: "GHSA-29mw-wpgm-hmr9",
                  database_specific: { severity: "MODERATE" },
                  affected: [
                    { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] },
                  ],
                },
              ],
              groups: [{ ids: ["GHSA-29mw-wpgm-hmr9"], max_severity: "5.3" }],
            },
          ],
        },
      ],
    };

    const { blocking, informational } = classifyVulnerabilities(report);
    expect(blocking).toEqual([]);
    expect(informational).toHaveLength(1);
    expect(informational[0].severity).toBe("MODERATE");
  });

  it("blocks a CRITICAL severity vulnerability with a fix", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "minimist", version: "0.0.8" },
              vulnerabilities: [
                {
                  id: "GHSA-xvch-5gv4-984h",
                  database_specific: { severity: "CRITICAL" },
                  affected: [
                    { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.2.3" }] }] },
                  ],
                },
              ],
              groups: [{ ids: ["GHSA-xvch-5gv4-984h"], max_severity: "9.8" }],
            },
          ],
        },
      ],
    };

    const { blocking } = classifyVulnerabilities(report);
    expect(blocking).toHaveLength(1);
    expect(blocking[0].severity).toBe("CRITICAL");
  });

  it("falls back to the group's CVSS max_severity when database_specific.severity is missing", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "some-pkg", version: "1.0.0" },
              vulnerabilities: [
                {
                  id: "GHSA-no-rating",
                  affected: [
                    { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "2.0.0" }] }] },
                  ],
                },
              ],
              groups: [{ ids: ["GHSA-no-rating"], max_severity: "9.1" }],
            },
          ],
        },
      ],
    };

    const { blocking } = classifyVulnerabilities(report);
    expect(blocking).toEqual([
      {
        packageName: "some-pkg",
        packageVersion: "1.0.0",
        vulnerabilityId: "GHSA-no-rating",
        severity: "CRITICAL",
        hasFix: true,
      },
    ]);
  });

  it("treats a vulnerability with no severity information at all as informational, not blocking", () => {
    const report: OsvScanReport = {
      results: [
        {
          packages: [
            {
              package: { name: "mystery-pkg", version: "1.0.0" },
              vulnerabilities: [
                {
                  id: "GHSA-unknown-severity",
                  affected: [
                    { ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "2.0.0" }] }] },
                  ],
                },
              ],
              groups: [{ ids: ["GHSA-unknown-severity"], max_severity: "" }],
            },
          ],
        },
      ],
    };

    const { blocking, informational } = classifyVulnerabilities(report);
    expect(blocking).toEqual([]);
    expect(informational).toEqual([
      {
        packageName: "mystery-pkg",
        packageVersion: "1.0.0",
        vulnerabilityId: "GHSA-unknown-severity",
        severity: "UNKNOWN",
        hasFix: true,
      },
    ]);
  });
});

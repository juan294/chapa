import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_LICENSES,
  findLicenseViolations,
  type PnpmLicenseReport,
} from "./check-licenses";

describe("findLicenseViolations", () => {
  it("passes packages whose license is on the allowlist", () => {
    const report: PnpmLicenseReport = {
      MIT: [{ name: "react", versions: ["19.2.7"], license: "MIT" }],
      "Apache-2.0": [{ name: "@vercel/analytics", versions: ["2.0.1"], license: "Apache-2.0" }],
    };

    expect(findLicenseViolations(report)).toEqual([]);
  });

  it("flags a package whose license is not on the allowlist", () => {
    const report: PnpmLicenseReport = {
      "GPL-3.0": [{ name: "some-copyleft-pkg", versions: ["1.0.0"], license: "GPL-3.0" }],
    };

    expect(findLicenseViolations(report)).toEqual([
      { license: "GPL-3.0", name: "some-copyleft-pkg", version: "1.0.0" },
    ]);
  });

  it("flags every version of a disallowed-license package absent an exclusion", () => {
    const report: PnpmLicenseReport = {
      "MPL-2.0": [
        { name: "some-other-mpl-pkg", versions: ["2.6.2"], license: "MPL-2.0" },
      ],
    };

    // No exclusions passed -- this package is not in DEFAULT_EXCLUDED_PACKAGES.
    expect(findLicenseViolations(report, { excluded: [] })).toEqual([
      { license: "MPL-2.0", name: "some-other-mpl-pkg", version: "2.6.2" },
    ]);
  });

  it("uses DEFAULT_EXCLUDED_PACKAGES to cover the documented @resvg/resvg-js exception", () => {
    const report: PnpmLicenseReport = {
      "MPL-2.0": [
        { name: "@resvg/resvg-js", versions: ["2.6.2"], license: "MPL-2.0" },
        { name: "@resvg/resvg-js-darwin-arm64", versions: ["2.6.2"], license: "MPL-2.0" },
      ],
    };

    // Uses the default exclusion list (no `excluded` option passed).
    expect(findLicenseViolations(report)).toEqual([]);
  });

  it("covers the Linux platform variants of @resvg/resvg-js and sharp-libvips (CI runs on Linux, not just macOS)", () => {
    const report: PnpmLicenseReport = {
      "MPL-2.0": [
        { name: "@resvg/resvg-js-linux-x64-gnu", versions: ["2.6.2"], license: "MPL-2.0" },
      ],
      "LGPL-3.0-or-later": [
        { name: "@img/sharp-libvips-linux-x64", versions: ["1.2.4"], license: "LGPL-3.0-or-later" },
      ],
    };

    // Uses the default exclusion list (no `excluded` option passed). Only the
    // darwin-arm64 variants were previously listed, which is exactly what
    // let this pass locally on macOS but fail on the Linux CI runner.
    expect(findLicenseViolations(report)).toEqual([]);
  });

  it("resolves an SPDX OR expression as passing if any alternative license is allowed", () => {
    const report: PnpmLicenseReport = {
      "(MPL-2.0 OR Apache-2.0)": [
        { name: "dompurify", versions: ["3.4.11"], license: "(MPL-2.0 OR Apache-2.0)" },
      ],
    };

    // Apache-2.0 is on the allowlist, so this should not be flagged even
    // though MPL-2.0 alone would not be.
    expect(findLicenseViolations(report)).toEqual([]);
  });

  it("resolves an SPDX AND expression as passing when every term is allowed", () => {
    const report: PnpmLicenseReport = {
      "(Apache-2.0 AND MIT)": [
        { name: "posthog-js", versions: ["1.422.5"], license: "(Apache-2.0 AND MIT)" },
      ],
    };

    // An AND expression obliges the consumer to satisfy every term, so it
    // passes only when all of them are allowed -- unlike OR, where one is
    // enough. Both Apache-2.0 and MIT are on the allowlist.
    expect(findLicenseViolations(report)).toEqual([]);
  });

  it("flags an SPDX AND expression when any single term is not allowed", () => {
    const report: PnpmLicenseReport = {
      "(MIT AND LGPL-3.0-or-later)": [
        { name: "hypothetical", versions: ["1.0.0"], license: "(MIT AND LGPL-3.0-or-later)" },
      ],
    };

    // LGPL-3.0-or-later is not on the allowlist and AND gives no way to avoid
    // it, so the package must still be flagged.
    expect(findLicenseViolations(report)).toEqual([
      { name: "hypothetical", version: "1.0.0", license: "(MIT AND LGPL-3.0-or-later)" },
    ]);
  });

  it("does not flag a package covered by an exact-version exclusion", () => {
    const report: PnpmLicenseReport = {
      "LGPL-3.0-or-later": [
        {
          name: "@img/sharp-libvips-darwin-arm64",
          versions: ["1.2.4"],
          license: "LGPL-3.0-or-later",
        },
      ],
    };

    const violations = findLicenseViolations(report, {
      excluded: [{ name: "@img/sharp-libvips-darwin-arm64", version: "1.2.4" }],
    });

    expect(violations).toEqual([]);
  });

  it("still flags an excluded package name at an unlisted version", () => {
    const report: PnpmLicenseReport = {
      "LGPL-3.0-or-later": [
        {
          name: "@img/sharp-libvips-darwin-arm64",
          versions: ["9.9.9"],
          license: "LGPL-3.0-or-later",
        },
      ],
    };

    const violations = findLicenseViolations(report, {
      excluded: [{ name: "@img/sharp-libvips-darwin-arm64", version: "1.2.4" }],
    });

    expect(violations).toEqual([
      {
        license: "LGPL-3.0-or-later",
        name: "@img/sharp-libvips-darwin-arm64",
        version: "9.9.9",
      },
    ]);
  });

  it("supports a version-less exclusion that covers every version of a package", () => {
    const report: PnpmLicenseReport = {
      "CC-BY-4.0": [
        {
          name: "caniuse-lite",
          versions: ["1.0.30001797", "1.0.30001799"],
          license: "CC-BY-4.0",
        },
      ],
    };

    const violations = findLicenseViolations(report, {
      excluded: [{ name: "caniuse-lite" }],
    });

    expect(violations).toEqual([]);
  });

  it("honors a custom allowed-license list over the default", () => {
    const report: PnpmLicenseReport = {
      "0BSD": [{ name: "some-pkg", versions: ["1.0.0"], license: "0BSD" }],
    };

    expect(findLicenseViolations(report, { allowed: ["MIT"] })).toEqual([
      { license: "0BSD", name: "some-pkg", version: "1.0.0" },
    ]);
  });

  it("exposes the default allowlist for reuse by the CLI entry point", () => {
    expect(DEFAULT_ALLOWED_LICENSES).toEqual(
      expect.arrayContaining(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"]),
    );
  });
});

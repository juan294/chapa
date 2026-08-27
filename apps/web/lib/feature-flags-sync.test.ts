/**
 * Unit tests for apps/web/lib/feature-flags-sync.ts
 *
 * Each sync helper reads a NEXT_PUBLIC_* env var via @/lib/env and returns
 * `true` ONLY when the trimmed value is exactly the string "true".
 *
 * Tests use `vi.stubEnv` to manipulate process.env values in isolation.
 */

import { describe, it, expect, afterEach, vi } from "vitest";

import {
  isStudioEnabledSync,
  isStudioDemoEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isGitlabEnabledSync,
  isInsightsEnabledSync,
  isWebmcpEnabledSync,
} from "./feature-flags-sync";

// ---------------------------------------------------------------------------
// isStudioEnabledSync — NEXT_PUBLIC_STUDIO_ENABLED
// ---------------------------------------------------------------------------

describe("isStudioEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "true");
    expect(isStudioEnabledSync()).toBe(true);
  });

  it("returns false when env var is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", undefined);
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns false for "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "false");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns false for "1" (not exact "true")', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "1");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "TRUE");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns false for "True" (mixed case)', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "True");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('returns false for empty string ""', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "");
    expect(isStudioEnabledSync()).toBe(false);
  });

  it('strips surrounding whitespace — " true " is treated as "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", " true ");
    expect(isStudioEnabledSync()).toBe(true);
  });

  it('returns false for "\ttrue\n" (tab/newline whitespace)', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", "\ttrue\n");
    expect(isStudioEnabledSync()).toBe(true);
  });

  it('returns false for " TRUE " (whitespace + wrong case)', () => {
    vi.stubEnv("NEXT_PUBLIC_STUDIO_ENABLED", " TRUE ");
    expect(isStudioEnabledSync()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBitbucketEnabledSync — NEXT_PUBLIC_BITBUCKET_ENABLED
// ---------------------------------------------------------------------------

describe("isBitbucketEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "true");
    expect(isBitbucketEnabledSync()).toBe(true);
  });

  it("returns false when env var is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", undefined);
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('returns false for "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "false");
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('returns false for "1"', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "1");
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "TRUE");
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('returns false for empty string ""', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", "");
    expect(isBitbucketEnabledSync()).toBe(false);
  });

  it('strips surrounding whitespace — " true " resolves to true', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", " true ");
    expect(isBitbucketEnabledSync()).toBe(true);
  });

  it('returns false for " TRUE " (whitespace + wrong case)', () => {
    vi.stubEnv("NEXT_PUBLIC_BITBUCKET_ENABLED", " TRUE ");
    expect(isBitbucketEnabledSync()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCodebergEnabledSync — NEXT_PUBLIC_CODEBERG_ENABLED
// ---------------------------------------------------------------------------

describe("isCodebergEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "true");
    expect(isCodebergEnabledSync()).toBe(true);
  });

  it("returns false when env var is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", undefined);
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('returns false for "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "false");
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('returns false for "1"', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "1");
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "TRUE");
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('returns false for empty string ""', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", "");
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it('strips surrounding whitespace — " true " resolves to true', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", " true ");
    expect(isCodebergEnabledSync()).toBe(true);
  });

  it('returns false for " TRUE " (whitespace + wrong case)', () => {
    vi.stubEnv("NEXT_PUBLIC_CODEBERG_ENABLED", " TRUE ");
    expect(isCodebergEnabledSync()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isGitlabEnabledSync — NEXT_PUBLIC_GITLAB_ENABLED
// ---------------------------------------------------------------------------

describe("isGitlabEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "true");
    expect(isGitlabEnabledSync()).toBe(true);
  });

  it("returns false when env var is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", undefined);
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('returns false for "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "false");
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('returns false for "1"', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "1");
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "TRUE");
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('returns false for empty string ""', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", "");
    expect(isGitlabEnabledSync()).toBe(false);
  });

  it('strips surrounding whitespace — " true " resolves to true', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", " true ");
    expect(isGitlabEnabledSync()).toBe(true);
  });

  it('returns false for " TRUE " (whitespace + wrong case)', () => {
    vi.stubEnv("NEXT_PUBLIC_GITLAB_ENABLED", " TRUE ");
    expect(isGitlabEnabledSync()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isInsightsEnabledSync — NEXT_PUBLIC_INSIGHTS_ENABLED
// ---------------------------------------------------------------------------

describe("isInsightsEnabledSync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for exact string "true"', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "true");
    expect(isInsightsEnabledSync()).toBe(true);
  });

  it("returns false when env var is undefined", () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", undefined);
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('returns false for "false"', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "false");
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('returns false for "1"', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "1");
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('returns false for "TRUE" (case-sensitive)', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "TRUE");
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('returns false for empty string ""', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", "");
    expect(isInsightsEnabledSync()).toBe(false);
  });

  it('strips surrounding whitespace — " true " resolves to true', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", " true ");
    expect(isInsightsEnabledSync()).toBe(true);
  });

  it('returns false for " TRUE " (whitespace + wrong case)', () => {
    vi.stubEnv("NEXT_PUBLIC_INSIGHTS_ENABLED", " TRUE ");
    expect(isInsightsEnabledSync()).toBe(false);
  });
});

describe.each([
  {
    label: "WebMCP",
    envKey: "NEXT_PUBLIC_WEBMCP_ENABLED",
    check: isWebmcpEnabledSync,
  },
  {
    label: "Studio demo",
    envKey: "NEXT_PUBLIC_STUDIO_DEMO_ENABLED",
    check: isStudioDemoEnabledSync,
  },
])("$label sync feature flag", ({ envKey, check }) => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true only for trimmed string "true"', () => {
    vi.stubEnv(envKey, " true ");
    expect(check()).toBe(true);
  });

  it.each([undefined, "false", "1", "TRUE", ""])(
    "returns false for %s",
    (value) => {
      vi.stubEnv(envKey, value);
      expect(check()).toBe(false);
    },
  );
});

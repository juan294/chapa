import { describe, it, expect } from "vitest";
import { _compose } from "./client";
import { makeStats } from "@/lib/test-helpers/fixtures";
import type { Platform, StatsData, SupplementalStats } from "@chapa/shared";

/**
 * #1193 (BE-S1) — `mergeStats` is a two-operand function used as a FOLD, so any
 * field whose meaning is "the GitHub-derived source's own value" cannot survive
 * that shape by construction. Three fields have that meaning:
 *
 * - `primaryReviewsSubmittedCount` — reviews from GitHub alone (BE-H1)
 * - `hasSupplementalData` — did an EMU/supplemental merge happen
 * - `fetchScope` — what the GitHub fetch could see (#1004/#1050)
 *
 * BE-H1 fixed the first two inside `mergeStats` by making them order-tolerant
 * (`?? ` and `||`). They now survive because of a property of the fold rather
 * than because anything says they must, so a fifth overlay re-opens the class.
 * `_compose` assigns all three once, at the end, from the ORIGINAL
 * githubDerived plus the overlay set. These tests pin that.
 */

function overlay(reviews: number, commits: number): StatsData {
  return makeStats({
    reviewsSubmittedCount: reviews,
    commitsTotal: commits,
    prsMergedCount: 1,
  });
}

// A fresh object each time: `as const` would make linkedPlatforms readonly,
// which StatsOverlays is not.
function noOverlays() {
  return {
    bitbucket: null as StatsData | null,
    codeberg: null as StatsData | null,
    gitlab: null as StatsData | null,
    supplemental: null as SupplementalStats | null,
    linkedPlatforms: [] as Platform[],
    linkedPlatformLogins: {} as Record<string, string>,
  };
}

const githubDerived = makeStats({
  reviewsSubmittedCount: 40,
  commitsTotal: 100,
  fetchScope: "authenticated",
});

const supplemental: SupplementalStats = {
  targetHandle: "octocat",
  sourceHandle: "octocat_emu",
  stats: overlay(7, 30),
  uploadedAt: "2026-01-01T00:00:00Z",
};

describe("_compose identity fields (#1193)", () => {
  it("keeps primaryReviewsSubmittedCount as the GitHub-derived count through every overlay", () => {
    const composed = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
      codeberg: overlay(6, 20),
      gitlab: overlay(9, 15),
      supplemental,
      linkedPlatforms: ["bitbucket", "codeberg", "gitlab"],
    });

    // Additive fields do accumulate...
    expect(composed.reviewsSubmittedCount).toBe(40 + 5 + 6 + 9 + 7);
    // ...but the GitHub-derived identity does not.
    expect(composed.primaryReviewsSubmittedCount).toBe(40);
  });

  it("holds the identity fields steady however many overlays are applied", () => {
    // The property that must not depend on overlay count or order: the fields
    // always describe the GitHub-derived operand, never the fold's last step.
    const one = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
    });
    const two = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
      gitlab: overlay(9, 15),
    });
    const three = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
      codeberg: overlay(6, 20),
      gitlab: overlay(9, 15),
    });

    for (const composed of [one, two, three]) {
      expect(composed.primaryReviewsSubmittedCount).toBe(
        githubDerived.reviewsSubmittedCount,
      );
      expect(composed.fetchScope).toBe(githubDerived.fetchScope);
      expect(composed.hasSupplementalData).toBe(false);
    }
  });

  it("leaves a value with no overlays exactly as it was", () => {
    // Nothing merged, so nothing to restate — and no keys added that a
    // never-merged value does not carry.
    expect(_compose(githubDerived, noOverlays())).toBe(githubDerived);
  });

  it("sets hasSupplementalData only when a supplemental overlay is present", () => {
    const withPlatformsOnly = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
      gitlab: overlay(9, 15),
    });
    expect(withPlatformsOnly.hasSupplementalData).toBe(false);

    const withSupplemental = _compose(githubDerived, {
      ...noOverlays(),
      supplemental,
    });
    expect(withSupplemental.hasSupplementalData).toBe(true);
  });

  it("never clears a hasSupplementalData already carried by the GitHub-derived value", () => {
    const alreadyMerged = makeStats({
      reviewsSubmittedCount: 40,
      hasSupplementalData: true,
    });
    const composed = _compose(alreadyMerged, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
    });
    expect(composed.hasSupplementalData).toBe(true);
  });

  it("carries fetchScope from the GitHub-derived value, never from an overlay", () => {
    // An overlay carrying a HIGHER-ranked scope must not raise the composed
    // value's scope: the non-downgrading cache rule (#1004/#1050) reads this
    // field as "what the GitHub fetch could see".
    const blinded = makeStats({ reviewsSubmittedCount: 40, fetchScope: "public" });
    const composed = _compose(blinded, {
      ...noOverlays(),
      bitbucket: makeStats({ fetchScope: "authenticated" }),
      supplemental,
    });
    expect(composed.fetchScope).toBe("public");
  });

  it("still applies linked platform metadata", () => {
    const composed = _compose(githubDerived, {
      ...noOverlays(),
      bitbucket: overlay(5, 10),
      linkedPlatforms: ["bitbucket"],
      linkedPlatformLogins: { bitbucket: "octo-bb" },
    });
    expect(composed.linkedPlatforms).toEqual(["bitbucket"]);
    expect(composed.linkedPlatformLogins).toEqual({ bitbucket: "octo-bb" });
  });
});

import { describe, it, expect, afterEach } from "vitest";
import {
  isStudioEnabled,
  isScoringPageEnabled,
  isExperimentsEnabled,
} from "./feature-flags";

describe("isStudioEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
  });

  it('returns true when set to "true"', () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "true";
    expect(isStudioEnabled()).toBe(true);
  });

  it("returns false when not set", () => {
    delete process.env.NEXT_PUBLIC_STUDIO_ENABLED;
    expect(isStudioEnabled()).toBe(false);
  });

  it('returns false when set to "false"', () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "false";
    expect(isStudioEnabled()).toBe(false);
  });

  it("returns false when set to empty string", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "";
    expect(isStudioEnabled()).toBe(false);
  });

  it("handles whitespace around the value", () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "  true  ";
    expect(isStudioEnabled()).toBe(true);
  });

  it('returns false for "1" (must be exactly "true")', () => {
    process.env.NEXT_PUBLIC_STUDIO_ENABLED = "1";
    expect(isStudioEnabled()).toBe(false);
  });
});

describe("isScoringPageEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED;
  });

  it('returns true when set to "true"', () => {
    process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED = "true";
    expect(isScoringPageEnabled()).toBe(true);
  });

  it("returns false when not set", () => {
    delete process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED;
    expect(isScoringPageEnabled()).toBe(false);
  });

  it('returns false when set to "false"', () => {
    process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED = "false";
    expect(isScoringPageEnabled()).toBe(false);
  });

  it("handles whitespace around the value", () => {
    process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED = "  true  ";
    expect(isScoringPageEnabled()).toBe(true);
  });
});

describe("isExperimentsEnabled", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED;
  });

  it('returns true when set to "true"', () => {
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED = "true";
    expect(isExperimentsEnabled()).toBe(true);
  });

  it("returns false when not set", () => {
    delete process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED;
    expect(isExperimentsEnabled()).toBe(false);
  });

  it('returns false when set to "false"', () => {
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED = "false";
    expect(isExperimentsEnabled()).toBe(false);
  });

  it("handles whitespace around the value", () => {
    process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED = "  true  ";
    expect(isExperimentsEnabled()).toBe(true);
  });
});

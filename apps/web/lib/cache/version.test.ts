import { describe, expect, it } from "vitest";
import { CACHE_VERSION, isScoringV7CacheKey, SCORING_V7_CACHE_VERSION } from "./version";

describe("scoring cache namespaces", () => {
  it("keeps v6 and v7 in separate namespaces", () => {
    expect(SCORING_V7_CACHE_VERSION).not.toBe(CACHE_VERSION);
  });

  it("recognises a v7 key and leaves v6 keys alone", () => {
    expect(isScoringV7CacheKey(`receipt:${SCORING_V7_CACHE_VERSION}:alice`)).toBe(true);
    expect(isScoringV7CacheKey(`snapshot:${CACHE_VERSION}:latest:alice`)).toBe(false);
    expect(isScoringV7CacheKey(`badge:${CACHE_VERSION}:alice:ice-terminal-v2:2026-09-01:en`)).toBe(false);
  });

  it("does not mistake a handle containing the namespace for a v7 key", () => {
    expect(isScoringV7CacheKey(`snapshot:${CACHE_VERSION}:latest:v7-user`)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";

describe("sitemap.ts", () => {
  it("exports a default function that returns sitemap entries", () => {
    const result = sitemap();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes the home page", () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url.endsWith("/"));
    expect(home).toBeDefined();
  });

  it("includes the about page", () => {
    const result = sitemap();
    const about = result.find((entry) => entry.url.endsWith("/about"));
    expect(about).toBeDefined();
  });

  it("includes the privacy page", () => {
    const result = sitemap();
    const privacy = result.find((entry) => entry.url.endsWith("/privacy"));
    expect(privacy).toBeDefined();
  });

  it("includes the terms page", () => {
    const result = sitemap();
    const terms = result.find((entry) => entry.url.endsWith("/terms"));
    expect(terms).toBeDefined();
  });

  it("uses production base URL", () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.url).toMatch(/^https:\/\/chapa\.thecreativetoken\.com/);
    }
  });

  it("sets changeFrequency on all entries", () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.changeFrequency).toBeDefined();
    }
  });

  it("sets priority on all entries", () => {
    const result = sitemap();
    for (const entry of result) {
      expect(entry.priority).toBeDefined();
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });

  it("gives home page the highest priority", () => {
    const result = sitemap();
    const home = result.find((entry) => entry.url.endsWith("/"));
    expect(home!.priority).toBe(1);
  });
});

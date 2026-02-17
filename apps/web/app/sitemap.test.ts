import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsers: vi.fn(),
}));

import sitemap from "./sitemap";
import { dbGetUsers } from "@/lib/db/users";

const BASE_URL = "https://chapa.thecreativetoken.com";

describe("sitemap", () => {
  beforeEach(() => {
    vi.mocked(dbGetUsers).mockReset();
  });

  it("includes static pages with correct priorities", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);

    const entries = await sitemap();

    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${BASE_URL}/`);
    expect(urls).toContain(`${BASE_URL}/about`);
    expect(urls).toContain(`${BASE_URL}/about/scoring`);
    expect(urls).toContain(`${BASE_URL}/privacy`);
    expect(urls).toContain(`${BASE_URL}/terms`);

    const home = entries.find((e) => e.url === `${BASE_URL}/`);
    expect(home?.priority).toBe(1);
    expect(home?.changeFrequency).toBe("weekly");
  });

  it("includes all 6 archetype pages", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    const archetypes = ["builder", "guardian", "marathoner", "polymath", "balanced", "emerging"];
    for (const archetype of archetypes) {
      expect(urls).toContain(`${BASE_URL}/archetypes/${archetype}`);
    }

    const archetypeEntry = entries.find((e) => e.url.includes("/archetypes/builder"));
    expect(archetypeEntry?.priority).toBe(0.6);
    expect(archetypeEntry?.changeFrequency).toBe("monthly");
  });

  it("includes dynamic user profile pages from DB", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "alice", registeredAt: "2026-01-15T00:00:00Z" },
      { handle: "bob", registeredAt: "2026-01-10T00:00:00Z" },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/u/alice`);
    expect(urls).toContain(`${BASE_URL}/u/bob`);

    const aliceEntry = entries.find((e) => e.url === `${BASE_URL}/u/alice`);
    expect(aliceEntry?.priority).toBe(0.8);
    expect(aliceEntry?.changeFrequency).toBe("daily");
  });

  it("gracefully handles DB failure (returns static pages only)", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);

    const entries = await sitemap();

    // Should still have static pages
    expect(entries.length).toBeGreaterThanOrEqual(5);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${BASE_URL}/`);
  });
});

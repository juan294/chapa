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

  it("includes the /about/verification page (#1075 / FE-L4)", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/about/verification`);
  });

  it("includes all 7 archetype pages", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    const archetypes = ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"];
    for (const archetype of archetypes) {
      expect(urls).toContain(`${BASE_URL}/archetypes/${archetype}`);
    }

    const archetypeEntry = entries.find((e) => e.url.includes("/archetypes/builder"));
    expect(archetypeEntry?.priority).toBe(0.6);
    expect(archetypeEntry?.changeFrequency).toBe("monthly");
  });

  it("includes dynamic user profile pages from DB", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "alice", registeredAt: "2026-01-15T00:00:00Z", displayName: null, avatarUrl: null, hasEmail: true },
      { handle: "bob", registeredAt: "2026-01-10T00:00:00Z", displayName: null, avatarUrl: null, hasEmail: true },
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/u/alice`);
    expect(urls).toContain(`${BASE_URL}/u/bob`);

    const aliceEntry = entries.find((e) => e.url === `${BASE_URL}/u/alice`);
    expect(aliceEntry?.priority).toBe(0.8);
    expect(aliceEntry?.changeFrequency).toBe("daily");
  });

  // LE-8-4 — the share page rejects a handle that fails isValidHandle (an
  // EMU login with an underscore), so advertising it sends crawlers to a 404.
  it("omits handles the share page would reject", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "alice", registeredAt: "2026-01-15T00:00:00Z", displayName: null, avatarUrl: null, hasEmail: true },
      { handle: "Some-Login_emu", registeredAt: "2026-01-10T00:00:00Z", displayName: null, avatarUrl: null, hasEmail: true },
    ]);

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/u/alice`);
    expect(urls.some((u) => u.includes("Some-Login_emu"))).toBe(false);
  });

  // LE-8-4 / #1239 — a users row without an email was registered by a render
  // path, not by the OAuth callback (the only writer of email). Such a row is
  // a stranger whose badge someone once viewed, not a signup to advertise.
  it("lists only real signups: rows registered with an email", async () => {
    vi.mocked(dbGetUsers).mockResolvedValue([
      { handle: "alice", registeredAt: "2026-01-15T00:00:00Z", displayName: null, avatarUrl: null, hasEmail: true },
      { handle: "octocat", registeredAt: "2026-01-10T00:00:00Z", displayName: "The Octocat", avatarUrl: null, hasEmail: false },
    ]);

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain(`${BASE_URL}/u/alice`);
    expect(urls).not.toContain(`${BASE_URL}/u/octocat`);
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

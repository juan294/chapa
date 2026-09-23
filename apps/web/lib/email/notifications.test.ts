import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the module under test.
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

// Import after mocks are set up
import { notifyFirstBadge } from "./notifications";
import { _resetClient } from "./resend";
import { scoringConsistencyFixture } from "@/lib/profile/__fixtures__/scoring-consistency";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sampleScoring() {
  const fixture = await scoringConsistencyFixture({ craft: 0, boundary: true });
  return fixture.model;
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();

  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("RESEND_API_KEY", "re_test_123");
  vi.stubEnv("SUPPORT_FORWARD_EMAIL", "juan@gmail.com");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");

  mockCacheGet.mockResolvedValue(null);
  mockCacheSet.mockResolvedValue(true);
  mockSend.mockResolvedValue({ data: { id: "msg_123" }, error: null });
});

// ---------------------------------------------------------------------------
// Environment guards
// ---------------------------------------------------------------------------

describe("environment guards", () => {
  it("skips when VERCEL_ENV is not production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");

    await notifyFirstBadge("testuser", await sampleScoring());

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when VERCEL_ENV is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "");

    await notifyFirstBadge("testuser", await sampleScoring());

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("deduplication", () => {
  it("skips when Redis marker exists", async () => {
    mockCacheGet.mockResolvedValueOnce(true);

    await notifyFirstBadge("testuser", await sampleScoring());

    expect(mockCacheGet).toHaveBeenCalledWith("badge:notified:testuser");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends email and sets marker when marker is absent", async () => {
    await notifyFirstBadge("testuser", await sampleScoring());

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "badge:notified:testuser",
      true,
      31_536_000,
    );
  });

  it("lowercases handle for the Redis key", async () => {
    await notifyFirstBadge("TestUser", await sampleScoring());

    expect(mockCacheGet).toHaveBeenCalledWith("badge:notified:testuser");
    expect(mockCacheSet).toHaveBeenCalledWith(
      "badge:notified:testuser",
      true,
      31_536_000,
    );
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe("graceful degradation", () => {
  it("does not throw when Resend is unavailable", async () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(
      notifyFirstBadge("testuser", await sampleScoring()),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    await expect(
      notifyFirstBadge("testuser", await sampleScoring()),
    ).resolves.toBeUndefined();
  });

  it("does not set marker when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    await notifyFirstBadge("testuser", await sampleScoring());

    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Current receipt notification content
// ---------------------------------------------------------------------------

describe("current receipt notification content", () => {
  it("uses the current canonical headline, dimensions and Craft", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 0, boundary: true });
    await notifyFirstBadge("alice", fixture.model);
    const payload = mockSend.mock.calls[0]![0];
    expect(payload.subject).toContain("alice");
    expect(payload.subject).toContain("v7.2");
    expect(payload.text).toContain("Policy: v7.2");
    expect(payload.text).toContain("Score: 69.99");
    expect(payload.text).toContain("Craft: 0");
    expect(payload.text).toContain(fixture.model.identity!.revisionId);
    expect(payload.text).toContain(
      "https://chapa.thecreativetoken.com/u/alice/badge.svg",
    );
    expect(payload.html).toContain(fixture.model.identity!.revisionId);
  });

  it("suppresses a notification with unavailable current authority", async () => {
    const fixture = await scoringConsistencyFixture();
    await notifyFirstBadge("alice", { ...fixture.model, freshness: "unavailable" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("suppresses an illustrative (sample) scoring model", async () => {
    const fixture = await scoringConsistencyFixture();
    await notifyFirstBadge("alice", { ...fixture.model, illustrative: true });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

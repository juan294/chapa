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
// #1335 phase 5 ("delete v6") — `notifyFirstBadge` no longer takes a legacy
// `ImpactV6Result`; the receipt-only plain-text body (previously this
// function's v7.2 branch) is the only body there is now. Every test below
// supplies a real sealed v7.2 receipt view model via the shared fixture.
// ---------------------------------------------------------------------------

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
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("testuser", f.model);

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when VERCEL_ENV is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("testuser", f.model);

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
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("testuser", f.model);

    expect(mockCacheGet).toHaveBeenCalledWith("badge:notified:testuser");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends email and sets marker when marker is absent", async () => {
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("testuser", f.model);

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "badge:notified:testuser",
      true,
      31_536_000,
    );
  });

  it("lowercases handle for the Redis key", async () => {
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("TestUser", f.model);

    expect(mockCacheGet).toHaveBeenCalledWith("badge:notified:testuser");
    expect(mockCacheSet).toHaveBeenCalledWith(
      "badge:notified:testuser",
      true,
      31_536_000,
    );
  });
});

// ---------------------------------------------------------------------------
// Email content
// ---------------------------------------------------------------------------

describe("current receipt notification content", () => {
  it("uses the current canonical headline, dimensions and Craft instead of legacy traps", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 0, boundary: true });

    await notifyFirstBadge("alice", fixture.model);

    const payload = mockSend.mock.calls[0]![0];
    expect(payload.subject).toContain("alice");
    expect(payload.text).toContain("Policy: v7.2");
    expect(payload.text).toContain("Score: 69.99");
    expect(payload.text).toContain("Craft: 0");
    expect(payload.text).toContain(fixture.model.identity!.revisionId);
    expect(payload.text).not.toMatch(/Confidence:|Adjusted:|Builder|Craft: 83/);
  });

  it("includes the share and badge URLs", async () => {
    const fixture = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("alice", fixture.model);

    const payload = mockSend.mock.calls[0]![0];
    expect(payload.text).toContain("https://chapa.thecreativetoken.com/u/alice");
    expect(payload.text).toContain("https://chapa.thecreativetoken.com/u/alice/badge.svg");
    expect(payload.html).toContain("Score:");
  });

  it("suppresses a notification with unavailable current authority", async () => {
    const fixture = await scoringConsistencyFixture();

    await notifyFirstBadge("alice", { ...fixture.model, freshness: "unavailable" });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("suppresses a notification for an illustrative/demo model", async () => {
    const fixture = await scoringConsistencyFixture();

    await notifyFirstBadge("alice", { ...fixture.model, illustrative: true });

    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe("graceful degradation", () => {
  it("does not throw when Resend is unavailable", async () => {
    _resetClient();
    vi.stubEnv("RESEND_API_KEY", "");
    const f = await scoringConsistencyFixture({ craft: 0 });

    await expect(
      notifyFirstBadge("testuser", f.model),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });
    const f = await scoringConsistencyFixture({ craft: 0 });

    await expect(
      notifyFirstBadge("testuser", f.model),
    ).resolves.toBeUndefined();
  });

  it("does not set marker when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });
    const f = await scoringConsistencyFixture({ craft: 0 });

    await notifyFirstBadge("testuser", f.model);

    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

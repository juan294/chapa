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

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://chapa.thecreativetoken.com",
}));

// Import after mocks are set up
import { notifyFirstBadge } from "./notifications";
import { _resetClient } from "./resend";
import type { ImpactV4Result } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleImpact: ImpactV4Result = {
  handle: "TestUser",
  profileType: "solo",
  dimensions: { building: 80, guarding: 60, consistency: 70, breadth: 50 },
  archetype: "Builder",
  compositeScore: 72,
  confidence: 85,
  confidencePenalties: [],
  adjustedComposite: 61,
  tier: "High",
  computedAt: "2026-01-15T10:00:00Z",
};

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

    await notifyFirstBadge("testuser", sampleImpact);

    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("skips when VERCEL_ENV is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "");

    await notifyFirstBadge("testuser", sampleImpact);

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

    await notifyFirstBadge("testuser", sampleImpact);

    expect(mockCacheGet).toHaveBeenCalledWith("badge:notified:testuser");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends email and sets marker when marker is absent", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "badge:notified:testuser",
      true,
      31_536_000,
    );
  });

  it("lowercases handle for the Redis key", async () => {
    await notifyFirstBadge("TestUser", sampleImpact);

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

describe("email content", () => {
  it("includes handle, archetype, and tier in subject", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    const call = mockSend.mock.calls[0]![0];
    expect(call.subject).toContain("testuser");
    expect(call.subject).toContain("Builder");
    expect(call.subject).toContain("High");
  });

  it("includes score, confidence, and share URL in body", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("61"); // adjustedComposite
    expect(call.html).toContain("85"); // confidence
    expect(call.html).toContain(
      "https://chapa.thecreativetoken.com/u/testuser",
    );
    expect(call.text).toContain("61");
    expect(call.text).toContain("85");
    expect(call.text).toContain(
      "https://chapa.thecreativetoken.com/u/testuser",
    );
  });

  it("includes dimension scores in body", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    const call = mockSend.mock.calls[0]![0];
    // HTML should contain all four dimension values
    expect(call.html).toContain("80"); // building
    expect(call.html).toContain("60"); // guarding
    expect(call.html).toContain("70"); // consistency
    expect(call.html).toContain("50"); // breadth
    // Plain text too
    expect(call.text).toContain("Building:");
    expect(call.text).toContain("80");
    expect(call.text).toContain("Guarding:");
    expect(call.text).toContain("60");
    expect(call.text).toContain("Consistency:");
    expect(call.text).toContain("70");
    expect(call.text).toContain("Breadth:");
    expect(call.text).toContain("50");
  });

  it("includes badge SVG link in body", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain(
      "https://chapa.thecreativetoken.com/u/testuser/badge.svg",
    );
    expect(call.text).toContain(
      "https://chapa.thecreativetoken.com/u/testuser/badge.svg",
    );
  });

  it("includes Chapa branding in HTML", async () => {
    await notifyFirstBadge("testuser", sampleImpact);

    const call = mockSend.mock.calls[0]![0];
    expect(call.html).toContain("#7C6AEF"); // brand purple
    expect(call.html).toContain("CHAPA");
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
      notifyFirstBadge("testuser", sampleImpact),
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not throw when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    await expect(
      notifyFirstBadge("testuser", sampleImpact),
    ).resolves.toBeUndefined();
  });

  it("does not set marker when send fails", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "Rate limited" },
    });

    await notifyFirstBadge("testuser", sampleImpact);

    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

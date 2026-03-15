// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./resend", () => ({
  getResend: vi.fn(),
  escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
}));

vi.mock("./templates/announcement", () => ({
  buildAnnouncementHtml: vi.fn(() => "<html>test</html>"),
  buildAnnouncementText: vi.fn(() => "test text"),
}));

vi.mock("@/lib/db/users", () => ({
  dbGetUsersWithEmail: vi.fn(),
}));

vi.mock("@/lib/db/campaigns", () => ({
  dbGetCampaign: vi.fn(),
  dbUpdateCampaign: vi.fn(),
  dbCreateCampaignSends: vi.fn(),
  dbGetPendingSends: vi.fn(),
  dbMarkSendsSent: vi.fn(),
  dbMarkSendsFailed: vi.fn(),
  dbGetCampaignStats: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheIncr: vi.fn().mockResolvedValue(1),
}));

import { getResend } from "./resend";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import {
  dbGetCampaign,
  dbUpdateCampaign,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
} from "@/lib/db/campaigns";
import { cacheGet } from "@/lib/cache/redis";
import { initiateCampaign, processCampaignBatch } from "./campaigns";

const mockBatchSend = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getResend).mockReturnValue({
    batch: { send: mockBatchSend },
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  vi.mocked(cacheGet).mockResolvedValue(null);
});

const draftCampaign = {
  id: "campaign-1",
  name: "Test Campaign",
  subject: "Test Subject",
  previewText: null,
  headline: "Test Headline",
  bodyText: "Test body",
  features: [{ text: "Feature 1" }],
  ctaText: "Click Here",
  ctaUrl: "https://example.com",
  status: "draft" as const,
  totalRecipients: 0,
  sentCount: 0,
  failedCount: 0,
  createdAt: "2026-03-15T00:00:00Z",
  startedAt: null,
  completedAt: null,
};

// ---------------------------------------------------------------------------
// initiateCampaign
// ---------------------------------------------------------------------------

describe("initiateCampaign", () => {
  it("creates sends for all eligible users", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
      { handle: "bob", email: "bob@example.com", displayName: null, avatarUrl: null },
    ]);
    vi.mocked(dbCreateCampaignSends).mockResolvedValue(2);
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await initiateCampaign("campaign-1");

    expect(result).toEqual({ totalRecipients: 2 });
    expect(dbCreateCampaignSends).toHaveBeenCalledWith("campaign-1", [
      { handle: "alice", email: "alice@example.com" },
      { handle: "bob", email: "bob@example.com" },
    ]);
    expect(dbUpdateCampaign).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      status: "sending",
      totalRecipients: 2,
    }));
  });

  it("returns null for non-draft campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue({
      ...draftCampaign,
      status: "sending",
    });

    const result = await initiateCampaign("campaign-1");
    expect(result).toBeNull();
  });

  it("returns null when no eligible users", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([]);

    const result = await initiateCampaign("campaign-1");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// processCampaignBatch
// ---------------------------------------------------------------------------

describe("processCampaignBatch", () => {
  const sendingCampaign = { ...draftCampaign, status: "sending" as const };

  it("sends batch and marks sends as sent", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbGetPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "pending", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"]);
  });

  it("respects daily quota limit", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(cacheGet).mockResolvedValue(95); // quota exhausted

    const result = await processCampaignBatch("campaign-1");

    expect(result.remaining).toBe(-1);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it("marks campaign as sent when all sends processed", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbGetPendingSends).mockResolvedValue([]); // no pending
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 10, pending: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(dbUpdateCampaign).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      status: "sent",
    }));
  });

  it("handles Resend batch error", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbGetPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "pending", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limited", statusCode: 429, name: "rate_limit" },
    });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 0, pending: 0, failed: 1 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result.failed).toBe(1);
    expect(dbMarkSendsFailed).toHaveBeenCalledWith(["s-1"], "Rate limited");
  });

  it("returns zeros for non-sending campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);

    const result = await processCampaignBatch("campaign-1");
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
  });
});

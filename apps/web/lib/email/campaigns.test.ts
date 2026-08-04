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
  dbClaimCampaignForSending: vi.fn(),
  dbCreateCampaignSends: vi.fn(),
  dbClaimPendingSends: vi.fn(),
  dbMarkSendsSent: vi.fn(),
  dbMarkSendsFailed: vi.fn(),
  dbRequeueSends: vi.fn(),
  dbGetCampaignStats: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheIncr: vi.fn().mockResolvedValue(1),
  cacheReserveQuota: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 95 }),
}));

import { getResend } from "./resend";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import {
  dbGetCampaign,
  dbUpdateCampaign,
  dbClaimCampaignForSending,
  dbCreateCampaignSends,
  dbClaimPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbRequeueSends,
  dbGetCampaignStats,
} from "@/lib/db/campaigns";
import { cacheGet, cacheIncr, cacheReserveQuota } from "@/lib/cache/redis";
import { initiateCampaign, processCampaignBatch, DAILY_SEND_LIMIT } from "./campaigns";

const mockBatchSend = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getResend).mockReturnValue({
    batch: { send: mockBatchSend },
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  vi.mocked(cacheGet).mockResolvedValue(null);
  vi.mocked(cacheReserveQuota).mockResolvedValue({ allowed: true, current: 1, limit: DAILY_SEND_LIMIT });
  vi.mocked(dbClaimCampaignForSending).mockResolvedValue(true);
  vi.mocked(dbMarkSendsSent).mockResolvedValue(true);
  vi.mocked(dbMarkSendsFailed).mockResolvedValue(true);
  vi.mocked(dbRequeueSends).mockResolvedValue(true);
});

const draftCampaign = {
  id: "campaign-1",
  type: "announcement" as const,
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
    expect(dbClaimCampaignForSending).toHaveBeenCalledWith(
      "campaign-1",
      2,
      expect.any(String),
    );
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

  it("does not claim a campaign when recipient persistence fails", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
    ]);
    vi.mocked(dbCreateCampaignSends).mockResolvedValue(0);

    await expect(initiateCampaign("campaign-1")).resolves.toBeNull();
    expect(dbClaimCampaignForSending).not.toHaveBeenCalled();
  });

  it("lets only the atomic draft claimant initiate a campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
    ]);
    vi.mocked(dbCreateCampaignSends).mockResolvedValue(1);
    vi.mocked(dbClaimCampaignForSending).mockResolvedValue(false);

    await expect(initiateCampaign("campaign-1")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// processCampaignBatch
// ---------------------------------------------------------------------------

describe("processCampaignBatch", () => {
  const sendingCampaign = { ...draftCampaign, status: "sending" as const };

  it("sends batch and marks sends as sent", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(dbClaimPendingSends).toHaveBeenCalledWith(
      "campaign-1",
      50,
      expect.any(String),
      expect.any(String),
    );
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"], expect.any(String));
    expect(mockBatchSend).toHaveBeenCalledWith(
      expect.any(Array),
      { idempotencyKey: expect.stringMatching(/^campaign\/campaign-1\/[a-f0-9]{64}$/) },
    );
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
    vi.mocked(dbClaimPendingSends).mockResolvedValue([]);
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 10, pending: 0, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(dbUpdateCampaign).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      status: "sent",
    }));
  });

  it("requeues a transient Resend batch error for retry", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({
      data: null,
      error: { message: "Rate limited", statusCode: 429, name: "rate_limit" },
    });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 0, pending: 1, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result).toEqual({ sent: 0, failed: 0, remaining: 1 });
    expect(dbRequeueSends).toHaveBeenCalledWith(["s-1"], "Rate limited", expect.any(String));
    expect(dbMarkSendsFailed).not.toHaveBeenCalled();
    expect(cacheIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      -1,
      86400,
    );
  });

  it("surfaces a sent acknowledgement write failure without marking the send failed", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbMarkSendsSent).mockResolvedValue(false);

    await expect(processCampaignBatch("campaign-1")).rejects.toThrow(
      "Failed to acknowledge sent campaign emails",
    );
    expect(dbMarkSendsFailed).not.toHaveBeenCalled();
    expect(cacheIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      -1,
      86400,
    );
  });

  it("keeps the provider idempotency key stable when an acknowledgement retry claims fewer rows", async () => {
    const sends = Array.from({ length: 50 }, (_, index) => ({
      id: `s-${String(index).padStart(2, "0")}`,
      campaignId: "campaign-1",
      handle: `user${index}`,
      email: `user${index}@example.com`,
      status: "processing" as const,
      sentAt: null,
      error: null,
    }));
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends)
      .mockResolvedValueOnce(sends)
      .mockResolvedValueOnce(sends.slice(0, 45));
    mockBatchSend
      .mockResolvedValueOnce({ data: sends.map((_, index) => ({ id: `msg-${index}` })), error: null })
      .mockResolvedValueOnce({ data: sends.slice(0, 45).map((_, index) => ({ id: `msg-${index}` })), error: null });
    vi.mocked(dbMarkSendsSent)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 45, pending: 5, processing: 0, failed: 0 });

    await expect(processCampaignBatch("campaign-1")).rejects.toThrow(
      "Failed to acknowledge sent campaign emails",
    );
    await expect(processCampaignBatch("campaign-1")).resolves.toEqual({
      sent: 45,
      failed: 0,
      remaining: 5,
    });

    const firstKey = mockBatchSend.mock.calls[0]?.[1]?.idempotencyKey;
    const retryKey = mockBatchSend.mock.calls[1]?.[1]?.idempotencyKey;
    expect(firstKey).toBe(retryKey);
  });

  it("returns zeros for non-sending campaign", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(draftCampaign);

    const result = await processCampaignBatch("campaign-1");
    expect(result).toEqual({ sent: 0, failed: 0, remaining: 0 });
  });

  it("does not increment quota again after a successful send because the reservation already counted it", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(cacheIncr).not.toHaveBeenCalled();
  });

  it("uses an atomic quota reservation helper before sending the batch", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(cacheReserveQuota).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      1,
      DAILY_SEND_LIMIT,
      86400,
    );
  });

  it("handles Resend partial batch failures as mixed sent/failed results", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
      { id: "s-2", campaignId: "campaign-1", handle: "bob", email: "bob@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({
      data: [
        { id: "ok-1" },
        { id: null, error: { message: "rejected" } },
      ],
      error: null,
    });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 1 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result).toEqual({ sent: 1, failed: 1, remaining: 0 });
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"], expect.any(String));
    expect(dbMarkSendsFailed).toHaveBeenCalledWith(["s-2"], "rejected", expect.any(String));
    expect(cacheIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      -1,
      86400,
    );
  });

  it("groups multiple failed sends with the same message into one failure write", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
      { id: "s-2", campaignId: "campaign-1", handle: "bob", email: "bob@example.com", status: "processing", sentAt: null, error: null },
      { id: "s-3", campaignId: "campaign-1", handle: "carol", email: "carol@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({
      data: [
        { id: "ok-1" },
        { id: null, error: { message: "mailbox unavailable" } },
        { id: null, error: { message: "mailbox unavailable" } },
      ],
      error: null,
    });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 2 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result).toEqual({ sent: 1, failed: 2, remaining: 0 });
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"], expect.any(String));
    expect(dbMarkSendsFailed).toHaveBeenCalledTimes(1);
    expect(dbMarkSendsFailed).toHaveBeenCalledWith(
      ["s-2", "s-3"],
      "mailbox unavailable",
      expect.any(String),
    );
    expect(cacheIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      -2,
      86400,
    );
  });

  it("treats missing batch result rows as unknown failures", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "alice@example.com", status: "processing", sentAt: null, error: null },
      { id: "s-2", campaignId: "campaign-1", handle: "bob", email: "bob@example.com", status: "processing", sentAt: null, error: null },
      { id: "s-3", campaignId: "campaign-1", handle: "carol", email: "carol@example.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({
      data: [
        { id: "ok-1" },
      ],
      error: null,
    });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 0, processing: 0, failed: 2 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result).toEqual({ sent: 1, failed: 2, remaining: 0 });
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"], expect.any(String));
    expect(dbMarkSendsFailed).toHaveBeenCalledWith(
      ["s-2", "s-3"],
      "Unknown Resend batch failure",
      expect.any(String),
    );
    expect(cacheIncr).toHaveBeenCalledWith(
      expect.stringMatching(/^campaign:daily-sends:\d{4}-\d{2}-\d{2}$/),
      -2,
      86400,
    );
  });

  it("sets final status to 'sent' when some sends succeed and some fail (mixed)", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([]);
    // Stats show both sent and failed
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 8, pending: 0, processing: 0, failed: 2 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    // Because sent > 0, status should be "sent" not "failed"
    expect(dbUpdateCampaign).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      status: "sent",
    }));
  });

  it("sets final status to 'failed' when all sends fail and none succeed", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([]);
    // All failed, none sent
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 0, pending: 0, processing: 0, failed: 5 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(dbUpdateCampaign).toHaveBeenCalledWith("campaign-1", expect.objectContaining({
      status: "failed",
    }));
  });

  it("limits batch size to remaining daily quota when available < BATCH_SIZE", async () => {
    // 85 already sent today → only 10 remaining (DAILY_SEND_LIMIT - 85 = 10)
    vi.mocked(cacheGet).mockResolvedValue(DAILY_SEND_LIMIT - 10);
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "a@e.com", status: "processing", sentAt: null, error: null },
      { id: "s-2", campaignId: "campaign-1", handle: "bob", email: "b@e.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }, { id: "msg-2" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 2, pending: 0, processing: 0, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    await processCampaignBatch("campaign-1");

    expect(dbClaimPendingSends).toHaveBeenCalledWith(
      "campaign-1",
      10,
      expect.any(String),
      expect.any(String),
    );
  });

  it("returns remaining count matching pending from stats", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "a@e.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 1, pending: 42, processing: 1, failed: 0 });
    vi.mocked(dbUpdateCampaign).mockResolvedValue(true);

    const result = await processCampaignBatch("campaign-1");

    expect(result.remaining).toBe(43);
  });

  it("does not call incrementDailyQuota when Resend client is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "a@e.com", status: "processing", sentAt: null, error: null },
    ]);
    vi.mocked(dbGetCampaignStats).mockResolvedValue({ sent: 0, pending: 0, processing: 0, failed: 1 });

    const result = await processCampaignBatch("campaign-1");

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    // cacheIncr should NOT be called since Resend was unavailable
    expect(cacheIncr).not.toHaveBeenCalled();
    expect(dbMarkSendsFailed).toHaveBeenCalledWith(["s-1"], "Resend unavailable", expect.any(String));
  });

  it("handles dbGetCampaignStats failure gracefully after sending", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([
      { id: "s-1", campaignId: "campaign-1", handle: "alice", email: "a@e.com", status: "processing", sentAt: null, error: null },
    ]);
    mockBatchSend.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    // Stats query throws after successful send
    vi.mocked(dbGetCampaignStats).mockRejectedValue(new Error("DB connection lost"));

    await expect(processCampaignBatch("campaign-1")).rejects.toThrow("DB connection lost");
    // The send itself succeeded — sends were marked
    expect(dbMarkSendsSent).toHaveBeenCalledWith(["s-1"], expect.any(String));
  });

  it("does not finalize while another worker still holds claimed sends", async () => {
    vi.mocked(dbGetCampaign).mockResolvedValue(sendingCampaign);
    vi.mocked(dbClaimPendingSends).mockResolvedValue([]);
    vi.mocked(dbGetCampaignStats).mockResolvedValue({
      sent: 5,
      pending: 0,
      processing: 2,
      failed: 0,
    });

    const result = await processCampaignBatch("campaign-1");

    expect(result).toEqual({ sent: 0, failed: 0, remaining: 2 });
    expect(dbUpdateCampaign).not.toHaveBeenCalled();
  });
});

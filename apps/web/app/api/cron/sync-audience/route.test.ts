// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/users", () => ({
  dbGetUsersWithEmail: vi.fn(),
}));

vi.mock("@/lib/email/resend", () => ({
  getResend: vi.fn(),
}));

vi.mock("@/lib/email/audience", () => ({
  ensureSegment: vi.fn(),
  addContact: vi.fn(),
  markUnsubscribed: vi.fn(),
}));

import { dbGetUsersWithEmail } from "@/lib/db/users";
import { getResend } from "@/lib/email/resend";
import { ensureSegment, addContact, markUnsubscribed } from "@/lib/email/audience";
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

function makeRequest(bearer?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return new NextRequest("https://example.com/api/cron/sync-audience", {
    headers,
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("sync-audience auth", () => {
  it("returns 401 without CRON_SECRET env var", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeRequest("anything"));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong Bearer token", async () => {
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

describe("sync-audience logic", () => {
  beforeEach(() => {
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: { data: [], has_more: false },
          error: null,
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  it("returns skipped when segment creation fails", async () => {
    vi.mocked(ensureSegment).mockResolvedValue(null);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("skipped");
    expect(body.reason).toBe("no_segment");
  });

  it("adds new contacts for users not in Resend", async () => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
      { handle: "bob", email: "bob@example.com", displayName: null, avatarUrl: null },
    ]);
    vi.mocked(addContact).mockResolvedValue("contact-id");

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(addContact).toHaveBeenCalledTimes(2);
    expect(addContact).toHaveBeenCalledWith("alice@example.com", {
      firstName: "Alice",
      handle: "alice",
    });
    expect(body.synced).toBe(2);
  });

  it("skips users already in Resend", async () => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: "Alice", avatarUrl: null },
    ]);
    // Alice already exists as a Resend contact
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: {
            data: [{ id: "c-1", email: "alice@example.com", unsubscribed: false }],
            has_more: false,
          },
          error: null,
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(addContact).not.toHaveBeenCalled();
    expect(body.synced).toBe(0);
  });

  it("marks contacts as unsubscribed when not in eligible list", async () => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([]);
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: {
            data: [{ id: "c-1", email: "old@example.com", unsubscribed: false }],
            has_more: false,
          },
          error: null,
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(markUnsubscribed).mockResolvedValue("c-1");

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(markUnsubscribed).toHaveBeenCalledWith("old@example.com");
    expect(body.unsubscribed).toBe(1);
  });

  it("handles empty user list gracefully", async () => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([]);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.status).toBe("ok");
    expect(body.synced).toBe(0);
    expect(body.totalEligible).toBe(0);
  });

  it("returns correct summary counts", async () => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([
      { handle: "alice", email: "alice@example.com", displayName: null, avatarUrl: null },
    ]);
    vi.mocked(addContact).mockResolvedValue("c-new");

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body).toEqual({
      status: "ok",
      synced: 1,
      unsubscribed: 0,
      totalEligible: 1,
      totalContacts: 0,
    });
  });
});

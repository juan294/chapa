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
  it("passes through when CRON_SECRET env var is not set", async () => {
    delete process.env.CRON_SECRET;
    // No CRON_SECRET configured = auth skipped (pass-through)
    vi.mocked(ensureSegment).mockResolvedValue(null);
    const res = await GET(makeRequest("anything"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("skipped");
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

// ---------------------------------------------------------------------------
// listAllContacts (tested through GET handler)
// ---------------------------------------------------------------------------

describe("listAllContacts behavior", () => {
  beforeEach(() => {
    vi.mocked(ensureSegment).mockResolvedValue("seg-123");
    vi.mocked(dbGetUsersWithEmail).mockResolvedValue([]);
  });

  it("paginates through multiple pages of contacts", async () => {
    const mockList = vi.fn()
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: "c-1", email: "a@example.com", unsubscribed: false },
            { id: "c-2", email: "b@example.com", unsubscribed: false },
          ],
          has_more: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: "c-3", email: "c@example.com", unsubscribed: false },
          ],
          has_more: false,
        },
        error: null,
      });

    vi.mocked(getResend).mockReturnValue({
      contacts: { list: mockList },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.totalContacts).toBe(3);
    // Second call should have cursor = last id from first page
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenNthCalledWith(2, { limit: 100, after: "c-2" });
  });

  it("handles empty data array from contacts list", async () => {
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: { data: [], has_more: false },
          error: null,
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.totalContacts).toBe(0);
  });

  it("handles error from resend during contact listing", async () => {
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "API error", statusCode: 500, name: "server_error" },
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    // On error, listAllContacts returns [] — totalContacts = 0
    expect(body.totalContacts).toBe(0);
  });

  it("returns empty contacts when getResend returns null", async () => {
    vi.mocked(getResend).mockReturnValue(null);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.totalContacts).toBe(0);
  });

  it("proceeds with empty users when dbGetUsersWithEmail rejects", async () => {
    vi.mocked(dbGetUsersWithEmail).mockRejectedValue(new Error("DB connection lost"));
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockResolvedValue({
          data: {
            data: [{ id: "c-1", email: "a@example.com", unsubscribed: false }],
            has_more: false,
          },
          error: null,
        }),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    // Should still return ok with contacts data even though users fetch failed
    expect(body.status).toBe("ok");
    expect(body.totalEligible).toBe(0);
    expect(body.totalContacts).toBe(1);
  });

  it("handles listAllContacts timeout by returning empty contacts", async () => {
    // Mock a very slow contacts.list that takes longer than the timeout
    vi.mocked(getResend).mockReturnValue({
      contacts: {
        list: vi.fn().mockImplementation(
          () => new Promise((resolve) => {
            // Never resolves within the timeout — simulate a hang
            setTimeout(() => resolve({
              data: { data: [{ id: "c-1", email: "a@example.com", unsubscribed: false }], has_more: false },
              error: null,
            }), 60_000);
          }),
        ),
      },
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // We need to use fake timers to test the timeout path
    vi.useFakeTimers();

    const promise = GET(makeRequest("test-secret"));

    // Advance past the 30s LIST_CONTACTS_TIMEOUT_MS
    await vi.advanceTimersByTimeAsync(31_000);

    const res = await promise;
    const body = await res.json();

    // Timeout triggers catch → returns [] → totalContacts = 0
    expect(body.totalContacts).toBe(0);
    expect(body.status).toBe("ok");

    vi.useRealTimers();
  });
});

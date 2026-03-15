// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockFrom = vi.fn((): any => ({
  select: (...args: unknown[]) => {
    mockSelect(...args);
    const chainable: any = {
      order: () => chainable,
      eq: () => chainable,
      in: () => Promise.resolve(queryResult),
      maybeSingle: () => Promise.resolve(queryResult),
      limit: () => Promise.resolve(queryResult),
      then: (resolve: (v: unknown) => void) => resolve(queryResult),
    };
    return chainable;
  },
  insert: (...args: unknown[]) => {
    mockInsert(...args);
    return {
      select: () => ({
        single: () => Promise.resolve(queryResult),
      }),
    };
  },
  update: (...args: unknown[]) => {
    mockUpdate(...args);
    return {
      eq: () => Promise.resolve(queryResult),
      in: () => Promise.resolve(queryResult),
    };
  },
  delete: () => {
    mockDelete();
    return {
      eq: (...eqArgs: unknown[]) => ({
        eq: () => Promise.resolve(queryResult),
      }),
    };
  },
  upsert: (...args: unknown[]) => {
    mockUpsert(...args);
    return Promise.resolve(queryResult);
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import {
  dbGetCampaigns,
  dbGetCampaign,
  dbCreateCampaign,
  dbUpdateCampaign,
  dbDeleteCampaign,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
} from "./campaigns";

beforeEach(() => {
  vi.clearAllMocks();
  queryResult = { data: null, error: null };
});

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

describe("dbGetCampaigns", () => {
  it("returns campaigns ordered by creation", async () => {
    queryResult = {
      data: [
        {
          id: "c-1",
          name: "Test",
          subject: "Subject",
          preview_text: null,
          headline: "Headline",
          body_text: "Body",
          features: [],
          cta_text: "Click",
          cta_url: "https://example.com",
          status: "draft",
          total_recipients: 0,
          sent_count: 0,
          failed_count: 0,
          created_at: "2026-03-15T00:00:00Z",
          started_at: null,
          completed_at: null,
        },
      ],
      error: null,
    };

    const result = await dbGetCampaigns();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Test");
    expect(result[0]!.ctaText).toBe("Click");
  });

  it("returns empty array when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetCampaigns();
    expect(result).toEqual([]);
  });
});

describe("dbGetCampaign", () => {
  it("returns single campaign by ID", async () => {
    queryResult = {
      data: {
        id: "c-1",
        name: "Test",
        subject: "Subject",
        preview_text: null,
        headline: "Headline",
        body_text: "Body",
        features: [{ text: "Feature 1" }],
        cta_text: "Click",
        cta_url: "https://example.com",
        status: "draft",
        total_recipients: 0,
        sent_count: 0,
        failed_count: 0,
        created_at: "2026-03-15T00:00:00Z",
        started_at: null,
        completed_at: null,
      },
      error: null,
    };

    const result = await dbGetCampaign("c-1");
    expect(result?.id).toBe("c-1");
    expect(result?.features).toEqual([{ text: "Feature 1" }]);
  });

  it("returns null for non-existent ID", async () => {
    queryResult = { data: null, error: null };
    const result = await dbGetCampaign("non-existent");
    expect(result).toBeNull();
  });
});

describe("dbCreateCampaign", () => {
  it("inserts and returns UUID", async () => {
    queryResult = { data: { id: "new-uuid" }, error: null };

    const result = await dbCreateCampaign({
      name: "Test",
      subject: "Subject",
      previewText: null,
      headline: "Headline",
      bodyText: "Body",
      features: [],
      ctaText: "Click",
      ctaUrl: "https://example.com",
    });

    expect(result).toBe("new-uuid");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns null when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbCreateCampaign({
      name: "Test",
      subject: "Subject",
      previewText: null,
      headline: "Headline",
      bodyText: "Body",
      features: [],
      ctaText: "Click",
      ctaUrl: "https://example.com",
    });
    expect(result).toBeNull();
  });
});

describe("dbUpdateCampaign", () => {
  it("updates specified fields", async () => {
    queryResult = { data: null, error: null };

    const result = await dbUpdateCampaign("c-1", { status: "sending" });
    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("dbDeleteCampaign", () => {
  it("deletes campaign", async () => {
    queryResult = { data: null, error: null };

    const result = await dbDeleteCampaign("c-1");
    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Campaign sends
// ---------------------------------------------------------------------------

describe("dbCreateCampaignSends", () => {
  it("bulk inserts pending sends", async () => {
    queryResult = { data: null, error: null };

    const count = await dbCreateCampaignSends("c-1", [
      { handle: "alice", email: "alice@example.com" },
      { handle: "bob", email: "bob@example.com" },
    ]);

    expect(count).toBe(2);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("returns 0 when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const count = await dbCreateCampaignSends("c-1", [
      { handle: "alice", email: "alice@example.com" },
    ]);
    expect(count).toBe(0);
  });
});

describe("dbGetPendingSends", () => {
  it("returns pending sends with limit", async () => {
    queryResult = {
      data: [
        {
          id: "s-1",
          campaign_id: "c-1",
          handle: "alice",
          email: "alice@example.com",
          status: "pending",
          sent_at: null,
          error: null,
        },
      ],
      error: null,
    };

    const result = await dbGetPendingSends("c-1", 50);
    expect(result).toHaveLength(1);
    expect(result[0]!.handle).toBe("alice");
  });
});

describe("dbMarkSendsSent", () => {
  it("updates status and timestamp", async () => {
    queryResult = { data: null, error: null };
    await dbMarkSendsSent(["s-1", "s-2"]);
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("dbMarkSendsFailed", () => {
  it("updates status and error", async () => {
    queryResult = { data: null, error: null };
    await dbMarkSendsFailed(["s-1"], "Send failed");
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("dbGetCampaignStats", () => {
  it("returns aggregate counts", async () => {
    queryResult = {
      data: [
        { status: "sent" },
        { status: "sent" },
        { status: "pending" },
        { status: "failed" },
      ],
      error: null,
    };

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 2, pending: 1, failed: 1 });
  });

  it("returns zeros when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, failed: 0 });
  });
});

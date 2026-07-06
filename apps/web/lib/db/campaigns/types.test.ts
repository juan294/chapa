import { describe, it, expect } from "vitest";
import {
  isCampaignStatus,
  isCampaignSendStatus,
  readFeatures,
  mapCampaignRow,
  mapSendRow,
  CampaignRowSchema,
  CampaignSendRowSchema,
  CAMPAIGN_ROW_REQUIRED_KEYS,
  CAMPAIGN_SEND_ROW_REQUIRED_KEYS,
} from "./types";

const VALID_CAMPAIGN_ROW = {
  id: "camp-1",
  type: "announcement",
  name: "Launch",
  subject: "We launched!",
  preview_text: "Big news",
  headline: "It's live",
  body_text: "Full body copy",
  features: [{ text: "Feature A" }],
  cta_text: "Check it out",
  cta_url: "https://example.com",
  status: "draft",
  total_recipients: 10,
  sent_count: 5,
  failed_count: 1,
  created_at: "2026-01-01T00:00:00Z",
  started_at: null,
  completed_at: null,
};

const VALID_SEND_ROW = {
  id: "send-1",
  campaign_id: "camp-1",
  handle: "octocat",
  email: "octocat@example.com",
  status: "sent",
  sent_at: "2026-01-01T00:00:00Z",
  error: null,
};

/** Shallow-copy `obj` without the given keys — used to build boundary-test fixtures. */
function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}

describe("isCampaignStatus", () => {
  it("returns true for every valid status", () => {
    for (const status of ["draft", "scheduled", "sending", "sent", "failed", "cancelled"]) {
      expect(isCampaignStatus(status)).toBe(true);
    }
  });

  it("returns false for an unknown status", () => {
    expect(isCampaignStatus("archived")).toBe(false);
  });
});

describe("isCampaignSendStatus", () => {
  it("returns true for every valid send status", () => {
    for (const status of ["pending", "processing", "sent", "failed"]) {
      expect(isCampaignSendStatus(status)).toBe(true);
    }
  });

  it("returns false for an unknown send status", () => {
    expect(isCampaignSendStatus("bounced")).toBe(false);
  });
});

describe("readFeatures", () => {
  it("returns an empty array for null/undefined", () => {
    expect(readFeatures(null)).toEqual([]);
    expect(readFeatures(undefined)).toEqual([]);
  });

  it("maps an array of { text } objects", () => {
    expect(readFeatures([{ text: "A" }, { text: "B" }])).toEqual([
      { text: "A" },
      { text: "B" },
    ]);
  });

  it("throws when value is not an array", () => {
    expect(() => readFeatures("not-an-array")).toThrow(/expected "features" to be an array/);
  });

  it("throws when an item is not an object", () => {
    expect(() => readFeatures(["nope"])).toThrow(/features\[0\] to be an object/);
  });

  it("throws when an item is an array", () => {
    expect(() => readFeatures([[]])).toThrow(/features\[0\] to be an object/);
  });

  it("throws when an item's text field is not a string", () => {
    expect(() => readFeatures([{ text: 5 }])).toThrow(/features\[0\]\.text to be a string/);
  });
});

describe("CampaignRowSchema.parse / mapCampaignRow", () => {
  it("parses a fully-populated valid row", () => {
    const campaign = mapCampaignRow(VALID_CAMPAIGN_ROW);
    expect(campaign).toEqual({
      id: "camp-1",
      type: "announcement",
      name: "Launch",
      subject: "We launched!",
      previewText: "Big news",
      headline: "It's live",
      bodyText: "Full body copy",
      features: [{ text: "Feature A" }],
      ctaText: "Check it out",
      ctaUrl: "https://example.com",
      status: "draft",
      totalRecipients: 10,
      sentCount: 5,
      failedCount: 1,
      createdAt: "2026-01-01T00:00:00Z",
      startedAt: null,
      completedAt: null,
    });
  });

  it("defaults optional numeric fields to 0 and nullable fields to null", () => {
    const minimalRow = {
      id: "camp-2",
      type: null,
      name: "Reminder",
      subject: "subj",
      headline: "head",
      body_text: "body",
      cta_text: "cta",
      cta_url: "https://example.com",
      status: "sent",
      created_at: "2026-01-02T00:00:00Z",
    };
    const campaign = mapCampaignRow(minimalRow);
    expect(campaign.type).toBe("announcement");
    expect(campaign.previewText).toBeNull();
    expect(campaign.totalRecipients).toBe(0);
    expect(campaign.sentCount).toBe(0);
    expect(campaign.failedCount).toBe(0);
    expect(campaign.startedAt).toBeNull();
    expect(campaign.completedAt).toBeNull();
    expect(campaign.features).toEqual([]);
  });

  it("maps type 'engagement' through unchanged", () => {
    const campaign = mapCampaignRow({ ...VALID_CAMPAIGN_ROW, type: "engagement" });
    expect(campaign.type).toBe("engagement");
  });

  it("throws when the row is missing a required key", () => {
    expect(() => CampaignRowSchema.parse(omit(VALID_CAMPAIGN_ROW, "id"))).toThrow(
      /missing required campaign fields/,
    );
  });

  it("throws when row is not an object", () => {
    expect(() => CampaignRowSchema.parse(null)).toThrow(/missing required campaign fields/);
  });

  it("throws on an unexpected campaign type", () => {
    expect(() => CampaignRowSchema.parse({ ...VALID_CAMPAIGN_ROW, type: "spam" })).toThrow(
      /unexpected campaign type/,
    );
  });

  it("throws on an unexpected campaign status", () => {
    expect(() =>
      CampaignRowSchema.parse({ ...VALID_CAMPAIGN_ROW, status: "archived" }),
    ).toThrow(/unexpected campaign status/);
  });

  it("throws when a required string field has the wrong type", () => {
    expect(() => CampaignRowSchema.parse({ ...VALID_CAMPAIGN_ROW, name: 123 })).toThrow(
      /expected "name" to be a string/,
    );
  });

  it("throws when a numeric field is not a number", () => {
    expect(() =>
      CampaignRowSchema.parse({ ...VALID_CAMPAIGN_ROW, total_recipients: "ten" }),
    ).toThrow(/expected "total_recipients" to be a number/);
  });

  it("has every required key present as a key of the row shape", () => {
    for (const key of CAMPAIGN_ROW_REQUIRED_KEYS) {
      expect(key in VALID_CAMPAIGN_ROW).toBe(true);
    }
  });
});

describe("CampaignSendRowSchema.parse / mapSendRow", () => {
  it("parses a fully-populated valid send row", () => {
    const send = mapSendRow(VALID_SEND_ROW);
    expect(send).toEqual({
      id: "send-1",
      campaignId: "camp-1",
      handle: "octocat",
      email: "octocat@example.com",
      status: "sent",
      sentAt: "2026-01-01T00:00:00Z",
      error: null,
    });
  });

  it("defaults nullable fields to null when absent", () => {
    const send = mapSendRow(omit(VALID_SEND_ROW, "sent_at", "error"));
    expect(send.sentAt).toBeNull();
    expect(send.error).toBeNull();
  });

  it("throws when the row is missing a required key", () => {
    expect(() =>
      CampaignSendRowSchema.parse(omit(VALID_SEND_ROW, "handle")),
    ).toThrow(/missing required campaign send fields/);
  });

  it("throws on an unexpected send status", () => {
    expect(() =>
      CampaignSendRowSchema.parse({ ...VALID_SEND_ROW, status: "bounced" }),
    ).toThrow(/unexpected campaign send status/);
  });

  it("throws when a required string field has the wrong type", () => {
    expect(() => CampaignSendRowSchema.parse({ ...VALID_SEND_ROW, email: 5 })).toThrow(
      /expected "email" to be a string/,
    );
  });

  it("has every required key present as a key of the row shape", () => {
    for (const key of CAMPAIGN_SEND_ROW_REQUIRED_KEYS) {
      expect(key in VALID_SEND_ROW).toBe(true);
    }
  });
});

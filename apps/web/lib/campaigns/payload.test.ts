import { describe, expect, it } from "vitest";
import {
  parseCampaignCreatePayload,
  parseCampaignPatchPayload,
} from "./payload";

describe("parseCampaignCreatePayload", () => {
  it("parses a valid campaign body with defaults", () => {
    expect(
      parseCampaignCreatePayload({
        name: "Launch",
        subject: "Subject",
        headline: "Headline",
        bodyText: "Body",
        ctaText: "Click",
        ctaUrl: "https://example.com",
      }),
    ).toEqual({
      type: "announcement",
      name: "Launch",
      subject: "Subject",
      previewText: null,
      headline: "Headline",
      bodyText: "Body",
      features: [],
      ctaText: "Click",
      ctaUrl: "https://example.com",
    });
  });

  it("rejects malformed features before persistence", () => {
    expect(() =>
      parseCampaignCreatePayload({
        name: "Launch",
        subject: "Subject",
        headline: "Headline",
        bodyText: "Body",
        ctaText: "Click",
        ctaUrl: "https://example.com",
        features: [{ text: 42 }],
      }),
    ).toThrow(/features\[0\]\.text/i);
  });
});

describe("parseCampaignPatchPayload", () => {
  it("parses only provided editable fields", () => {
    expect(
      parseCampaignPatchPayload({
        previewText: null,
        features: [{ text: "One" }],
      }),
    ).toEqual({
      previewText: null,
      features: [{ text: "One" }],
    });
  });

  it("rejects invalid previewText types", () => {
    expect(() =>
      parseCampaignPatchPayload({ previewText: 42 }),
    ).toThrow(/previewText/i);
  });
});

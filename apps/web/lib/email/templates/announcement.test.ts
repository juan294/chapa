// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/resend", () => ({
  escapeHtml: (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
}));

import { buildAnnouncementHtml, buildAnnouncementText } from "./announcement";

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = "https://chapa.thecreativetoken.com";
});

const sampleData = {
  handle: "testuser",
  headline: "Your dashboard just got better",
  bodyText: "We shipped some new features you might like.",
  features: [
    { text: "New performance dimensions view" },
    { text: "Score history and trends" },
  ],
  ctaText: "See What's New",
  ctaUrl: "https://chapa.thecreativetoken.com",
  previewText: "Check out the latest updates",
};

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

describe("buildAnnouncementHtml", () => {
  it("includes escaped handle, headline, and body", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain("@testuser");
    expect(html).toContain("Your dashboard just got better");
    expect(html).toContain("We shipped some new features you might like.");
  });

  it("includes feature bullets", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain("New performance dimensions view");
    expect(html).toContain("Score history and trends");
    expect(html).toContain("&rarr;"); // arrow
  });

  it("includes CTA button with correct URL", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain('href="https://chapa.thecreativetoken.com"');
    expect(html).toContain("See What");
    expect(html).toContain("background:#8B5CF6");
  });

  it("includes unsubscribe link in footer", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain("Unsubscribe");
    expect(html).toContain("/api/notifications/unsubscribe?handle=testuser");
  });

  it("escapes XSS in user-controlled fields", () => {
    const xssData = {
      ...sampleData,
      handle: '<script>alert("xss")</script>',
      headline: '<img src=x onerror=alert(1)>',
    };
    const html = buildAnnouncementHtml(xssData);

    // Script tags are entity-escaped
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // img tag is entity-escaped (angle brackets become entities)
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("includes preview text when provided", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain("Check out the latest updates");
    expect(html).toContain("display:none");
  });

  it("omits preview text when not provided", () => {
    const noPreview = { ...sampleData, previewText: undefined };
    const html = buildAnnouncementHtml(noPreview);

    expect(html).not.toContain("display:none");
  });

  it("uses dark theme colors", () => {
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain("#0A0A0F"); // dark background
    expect(html).toContain("#8B5CF6"); // purple accent
    expect(html).toContain("CHAPA_"); // logo
  });
});

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

describe("buildAnnouncementText", () => {
  it("includes all sections", () => {
    const text = buildAnnouncementText(sampleData);

    expect(text).toContain("CHAPA");
    expect(text).toContain("@testuser");
    expect(text).toContain("Your dashboard just got better");
    expect(text).toContain("We shipped some new features you might like.");
    expect(text).toContain("\u2192 New performance dimensions view");
    expect(text).toContain("\u2192 Score history and trends");
    expect(text).toContain("See What's New: https://chapa.thecreativetoken.com");
  });

  it("includes unsubscribe URL", () => {
    const text = buildAnnouncementText(sampleData);

    expect(text).toContain(
      "Unsubscribe: https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle=testuser",
    );
  });
});

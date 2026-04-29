// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://chapa.thecreativetoken.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
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
    expect(html).toContain("/api/notifications/unsubscribe?handle=testuser&amp;token=");
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

  // ---------------------------------------------------------------------------
  // Body text splitting
  // ---------------------------------------------------------------------------

  it("renders single paragraph without dividers when body has no double newlines", () => {
    const data = { ...sampleData, bodyText: "Just a single paragraph." };
    const html = buildAnnouncementHtml(data);

    // Should have the paragraph content
    expect(html).toContain("Just a single paragraph.");
    // Should not have the thicker divider that only appears for multi-paragraph
    // (multiple paragraphs get a 0.40 opacity divider around the first paragraph)
    const dividerCount = (html.match(/rgba\(139,92,246,0\.40\)/g) || []).length;
    expect(dividerCount).toBe(0);
  });

  it("renders multiple paragraphs with dividers around the first paragraph", () => {
    const data = {
      ...sampleData,
      bodyText: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
    };
    const html = buildAnnouncementHtml(data);

    expect(html).toContain("First paragraph.");
    expect(html).toContain("Second paragraph.");
    expect(html).toContain("Third paragraph.");
    // The 0.40 opacity dividers appear around the first paragraph only
    const dividerCount = (html.match(/rgba\(139,92,246,0\.40\)/g) || []).length;
    expect(dividerCount).toBe(2); // one before, one after first paragraph
  });

  it("filters out empty paragraphs from body splitting", () => {
    const data = {
      ...sampleData,
      bodyText: "\n\n\n",
    };
    const html = buildAnnouncementHtml(data);

    // All paragraphs would be empty/whitespace after split and trim → filtered out
    // No <p> body content should be rendered
    expect(html).not.toContain('<p style="margin:0;font-family');
  });

  // ---------------------------------------------------------------------------
  // Empty features array
  // ---------------------------------------------------------------------------

  it("renders no feature rows when features array is empty", () => {
    const data = { ...sampleData, features: [] };
    const html = buildAnnouncementHtml(data);

    // No arrow feature rows
    expect(html).not.toContain("&rarr;");
  });

  // ---------------------------------------------------------------------------
  // getBaseUrl() fallback
  // ---------------------------------------------------------------------------

  it("uses NEXT_PUBLIC_BASE_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://custom.example.com");
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain(
      "/api/notifications/unsubscribe?handle=testuser&amp;token=",
    );
    expect(html).toContain("https://custom.example.com");
  });

  it("falls back to default URL when NEXT_PUBLIC_BASE_URL is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain(
      "https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle=testuser&amp;token=",
    );
  });

  it("falls back to default URL when NEXT_PUBLIC_BASE_URL is empty string", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "   ");
    const html = buildAnnouncementHtml(sampleData);

    expect(html).toContain(
      "https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle=testuser&amp;token=",
    );
  });

  // ---------------------------------------------------------------------------
  // Empty/whitespace body
  // ---------------------------------------------------------------------------

  it("handles empty body string gracefully", () => {
    const data = { ...sampleData, bodyText: "" };
    const html = buildAnnouncementHtml(data);

    // Should still render valid HTML
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("CHAPA_");
  });

  it("handles body with only whitespace gracefully", () => {
    const data = { ...sampleData, bodyText: "   " };
    const html = buildAnnouncementHtml(data);

    expect(html).toContain("<!DOCTYPE html>");
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
      "Unsubscribe: https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle=testuser&token=",
    );
  });

  it("mirrors HTML content structure in plain text", () => {
    const text = buildAnnouncementText(sampleData);

    // Check structure order: header → greeting → headline → body → features → CTA → footer
    const lines = text.split("\n");
    const chapaIndex = lines.findIndex((l) => l === "CHAPA");
    const greetingIndex = lines.findIndex((l) => l.includes("@testuser"));
    const headlineIndex = lines.findIndex((l) => l.includes("Your dashboard"));
    const bodyIndex = lines.findIndex((l) =>
      l.includes("We shipped some new features"),
    );
    const featureIndex = lines.findIndex((l) => l.includes("\u2192"));
    const ctaIndex = lines.findIndex((l) => l.includes("See What"));

    expect(chapaIndex).toBeLessThan(greetingIndex);
    expect(greetingIndex).toBeLessThan(headlineIndex);
    expect(headlineIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(featureIndex);
    expect(featureIndex).toBeLessThan(ctaIndex);
  });

  it("renders no feature arrows when features array is empty", () => {
    const data = { ...sampleData, features: [] };
    const text = buildAnnouncementText(data);

    expect(text).not.toContain("\u2192");
  });

  it("uses NEXT_PUBLIC_BASE_URL for unsubscribe link in plain text", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://custom.example.com");
    const text = buildAnnouncementText(sampleData);

    expect(text).toContain(
      "Unsubscribe: https://custom.example.com/api/notifications/unsubscribe?handle=testuser&token=",
    );
  });

  it("falls back to default URL in plain text when env var is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
    const text = buildAnnouncementText(sampleData);

    expect(text).toContain(
      "Unsubscribe: https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle=testuser&token=",
    );
  });
});

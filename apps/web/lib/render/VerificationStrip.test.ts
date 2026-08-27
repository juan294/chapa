import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  renderDemoVerificationStrip,
  renderVerificationStrip,
} from "./VerificationStrip";

describe("renderVerificationStrip", () => {
  const hash = "abc12345";
  const date = "2025-06-15";

  it("preserves the exact real and sample SVG bytes after metadata extraction", () => {
    // #1168 UX-H4 — these digests intentionally changed: font-size 11→14 and
    // opacity 0.50→0.9 (plus font-weight 500) on both strips for legibility.
    // This snapshot pins the new bytes; it is not a behavioral invariant.
    const digest = (svg: string) =>
      createHash("sha256").update(svg).digest("hex");

    expect(digest(renderVerificationStrip(hash, date))).toBe(
      "bfe965ab3e196818e577a2db1f9f81e41153aa075fcaac5632c39d69564d4c5e",
    );
    expect(digest(renderDemoVerificationStrip())).toBe(
      "f7d9fee55bb35bc930540d6978358f731ccd904f6630a544c19773da9a435745",
    );
  });

  it("returns an SVG <g> element", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("<g");
    expect(svg).toContain("</g>");
  });

  it("includes the hash in the output", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("abc12345");
  });

  it("includes the date in the output", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("2025-06-15");
  });

  it("includes VERIFIED text", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg.toUpperCase()).toContain("VERIFIED");
  });

  it("uses coral color (#E05A47)", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("#E05A47");
  });

  // #1168 UX-H4 — at the original 11px/50% opacity (~2.1:1 contrast), GitHub's
  // ~830/1200 README scaling put the real rendered size at ~7.6px, and the
  // <a> wrapper is inert when the badge is loaded via <img src> (the exact
  // embed form the product recommends) — so the strip was illegible AND
  // unclickable in its most common real-world context.
  it("verification text font-size is at least 14px for legibility", () => {
    const svg = renderVerificationStrip(hash, date);
    const match = svg.match(/font-size="(\d+)"[^>]*>VERIFIED/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1]!, 10)).toBeGreaterThanOrEqual(14);
  });

  it("verification text opacity is at least 0.85 for legibility", () => {
    const svg = renderVerificationStrip(hash, date);
    const match = svg.match(/opacity="([0-9.]+)"[^>]*>VERIFIED/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeGreaterThanOrEqual(0.85);
  });

  it("includes a separator line", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("<line");
  });

  it("does not include a shield icon (already on header)", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).not.toContain("<path");
  });

  it("uses rotation for vertical text", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("rotate(");
  });

  it("uses JetBrains Mono font", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("JetBrains Mono");
  });

  it("escapes XML special characters in hash", () => {
    const svg = renderVerificationStrip("<script>", date);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes XML special characters in date", () => {
    const svg = renderVerificationStrip(hash, '2025"06"15');
    expect(svg).not.toContain('2025"06"15');
    expect(svg).toContain("2025&quot;06&quot;15");
  });

  it("wraps verification text in an SVG <a> element", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain("<a");
    expect(svg).toContain("</a>");
  });

  it("links to the verification page for the given hash", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain(
      "https://chapa.thecreativetoken.com/verify/abc12345",
    );
  });

  it("opens the verification link in a new tab via target=_blank", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain('target="_blank"');
  });

  it("uses the escaped hash in the verification URL", () => {
    // Even with special characters in hash, URL should use the escaped form
    const svg = renderVerificationStrip("a1b2c3d4", date);
    expect(svg).toContain(
      "https://chapa.thecreativetoken.com/verify/a1b2c3d4",
    );
  });

  // #1168 — the <a> wrapper is a critical invariant: it's inert in an <img>
  // embed but works when the badge SVG is embedded inline (share page), so
  // it must never be removed even though it doesn't help the <img> case.
  it("critical invariant: the <a> wrapper around the verification text must never be removed", () => {
    const svg = renderVerificationStrip(hash, date);
    const aOpenIdx = svg.indexOf("<a ");
    const aCloseIdx = svg.indexOf("</a>");
    const textIdx = svg.indexOf(">VERIFIED");
    expect(aOpenIdx).toBeGreaterThan(-1);
    expect(aCloseIdx).toBeGreaterThan(-1);
    expect(aOpenIdx).toBeLessThan(textIdx);
    expect(textIdx).toBeLessThan(aCloseIdx);
  });
});

// ---------------------------------------------------------------------------
// Locale-aware labels (#1181 UX-H3) — both render functions stay pure/sync;
// resolved label strings are passed in by the caller, never resolved here.
// ---------------------------------------------------------------------------

describe("locale-aware labels (#1181)", () => {
  const hash = "abc12345";
  const date = "2025-06-15";

  it("renderVerificationStrip defaults to 'VERIFIED' when no label is given (backward compatible)", () => {
    const svg = renderVerificationStrip(hash, date);
    expect(svg).toContain(">VERIFIED");
  });

  it("renderVerificationStrip uses a translated verified label when provided", () => {
    const svg = renderVerificationStrip(hash, date, "VERIFICADO");
    expect(svg).toContain(">VERIFICADO");
    expect(svg).not.toContain(">VERIFIED");
    // hash/date still present and still escaped-safe
    expect(svg).toContain(hash);
    expect(svg).toContain(date);
  });

  it("renderDemoVerificationStrip defaults to the English disclosure when no label is given (backward compatible)", () => {
    const svg = renderDemoVerificationStrip();
    expect(svg).toContain(">SAMPLE · NOT A REAL BADGE · FOR ILLUSTRATION ONLY<");
  });

  it("renderDemoVerificationStrip uses a translated disclosure when provided", () => {
    const svg = renderDemoVerificationStrip("MUESTRA · NO ES UNA CHAPA REAL · SOLO PARA ILUSTRACIÓN");
    expect(svg).toContain(">MUESTRA · NO ES UNA CHAPA REAL · SOLO PARA ILUSTRACIÓN<");
    expect(svg).not.toContain("NOT A REAL BADGE");
  });
});

describe("renderDemoVerificationStrip", () => {
  // #1168 UX-H4 — the demo "SAMPLE / NOT A REAL BADGE" disclosure had the
  // same unreadable 11px/50%-opacity treatment as the real strip.
  it("SAMPLE disclosure font-size is at least 14px for legibility", () => {
    const svg = renderDemoVerificationStrip();
    const match = svg.match(/font-size="(\d+)"[^>]*>SAMPLE/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1]!, 10)).toBeGreaterThanOrEqual(14);
  });

  it("SAMPLE disclosure opacity is at least 0.85 for legibility", () => {
    const svg = renderDemoVerificationStrip();
    const match = svg.match(/opacity="([0-9.]+)"[^>]*>SAMPLE/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeGreaterThanOrEqual(0.85);
  });
});

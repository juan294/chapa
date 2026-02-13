import { describe, it, expect } from "vitest";
import { renderVerificationStrip } from "./VerificationStrip";

describe("renderVerificationStrip", () => {
  const hash = "abc12345";
  const date = "2025-06-15";

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
});

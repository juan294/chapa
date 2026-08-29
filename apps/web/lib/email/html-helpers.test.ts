import { describe, it, expect } from "vitest";
import { featureRow } from "./html-helpers";

describe("featureRow", () => {
  it("produces valid HTML with normal text input", () => {
    const html = featureRow("Hello World");
    expect(html).toContain("<tr>");
    expect(html).toContain("</tr>");
    expect(html).toContain("<td");
    expect(html).toContain("</td>");
    expect(html).toContain("Hello World");
    expect(html).toContain("&rarr;");
  });

  it("uses default paddingBottom of 12", () => {
    const html = featureRow("test");
    expect(html).toContain("padding-bottom:12px");
  });

  it("respects custom paddingBottom values", () => {
    expect(featureRow("a", 0)).toContain("padding-bottom:0px");
    expect(featureRow("a", 24)).toContain("padding-bottom:24px");
    expect(featureRow("a", 8)).toContain("padding-bottom:8px");
  });

  it("includes JetBrains Mono font for the arrow", () => {
    const html = featureRow("test");
    expect(html).toContain("font-family:'JetBrains Mono',monospace");
  });

  it("includes Plus Jakarta Sans font for the text", () => {
    const html = featureRow("test");
    expect(html).toContain("font-family:'Plus Jakarta Sans'");
  });

  it("passes HTML special characters through as-is (raw interpolation)", () => {
    const html = featureRow('<script>alert("xss")</script>');
    expect(html).toContain('<script>alert("xss")</script>');

    const htmlAmp = featureRow("A & B");
    expect(htmlAmp).toContain("A & B");

    const htmlAngle = featureRow("a < b > c");
    expect(htmlAngle).toContain("a < b > c");
  });

  it("handles empty string input", () => {
    const html = featureRow("");
    expect(html).toContain("<tr>");
    expect(html).toContain("</tr>");
    expect(html).toContain("&rarr;");
    // The text span should be present but with empty content
    expect(html).toContain("padding-bottom:12px");
  });

  it("uses the correct accent color for the arrow", () => {
    const html = featureRow("test");
    expect(html).toContain("color:#1BD093");
  });

  it("uses the correct text color for content", () => {
    const html = featureRow("test");
    expect(html).toContain("color:#E2E4E9");
  });
});

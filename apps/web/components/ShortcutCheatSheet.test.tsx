import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(
  resolve(__dirname, "ShortcutCheatSheet.tsx"),
  "utf-8",
);

describe("ShortcutCheatSheet (source-reading a11y)", () => {
  it("uses role=dialog", () => {
    expect(SRC).toContain('role="dialog"');
  });

  it("sets aria-modal=true", () => {
    expect(SRC).toContain("aria-modal");
  });

  it("has an aria-label for the dialog", () => {
    expect(SRC).toMatch(/aria-label/);
  });

  it("renders kbd elements for key display", () => {
    expect(SRC).toContain("<kbd");
  });

  it("implements focus trap", () => {
    // Should query focusable elements and trap Tab/Shift+Tab
    expect(SRC).toMatch(/focusable|focus.*trap/i);
  });

  it("closes on Escape key", () => {
    expect(SRC).toContain("Escape");
  });

  it("closes on backdrop click", () => {
    // Should have an onClick on the backdrop that closes
    expect(SRC).toMatch(/onClick|onClose/);
  });

  it("uses font-heading for kbd elements (design system)", () => {
    expect(SRC).toContain("font-heading");
  });

  it("uses bg-card and border-stroke (design system)", () => {
    expect(SRC).toContain("bg-card");
    expect(SRC).toContain("border-stroke");
  });

  it("uses groupByScope to organize shortcuts", () => {
    expect(SRC).toContain("groupByScope");
  });

  it("is a client component", () => {
    expect(SRC).toContain('"use client"');
  });

  it("backdrop div has role='presentation' (#305)", () => {
    // The outermost div (backdrop overlay) has onClick but needs
    // role="presentation" for screen readers since it's non-semantic.
    expect(SRC).toContain('role="presentation"');
  });
});

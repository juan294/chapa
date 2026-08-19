// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharePageH2 } from "./SharePageH2";

describe("SharePageH2", () => {
  it("renders the h2 with the translated text", () => {
    render(<SharePageH2 />);
    // useTranslation falls back to English when LanguageProvider is absent
    // English key: sharePage.h2 = 'Your Impact, Decoded'
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeDefined();
    expect(screen.getByText("Your Impact, Decoded")).toBeDefined();
    // W4 — h2 elements must use font-heading per design system.
    expect(heading.className).toContain("font-heading");
  });
});

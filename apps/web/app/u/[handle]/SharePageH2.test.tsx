// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharePageH2 } from "./SharePageH2";

describe("SharePageH2", () => {
  it("renders the h2 with the translated text", () => {
    render(<SharePageH2 />);
    // useTranslation falls back to English when LanguageProvider is absent
    // English key: sharePage.h2 = 'Your Impact, Decoded'
    expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
    expect(screen.getByText("Your Impact, Decoded")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SectionHeader } from "./SectionHeader";

afterEach(cleanup);

describe("SectionHeader (#1214)", () => {
  it("renders the command behind a % marker", () => {
    const { container } = render(<SectionHeader command="chapa features" />);
    expect(container.textContent).toContain("% chapa features");
  });

  it("renders right-aligned meta when given", () => {
    render(<SectionHeader command="chapa features" meta="exit 0 · 5 results" />);
    expect(screen.getByText("exit 0 · 5 results")).toBeDefined();
  });

  it("omits the meta span entirely when there is nothing to show", () => {
    const { container } = render(<SectionHeader command="chapa login" />);
    expect(container.querySelectorAll("span").length).toBe(2);
  });

  it("keeps both halves on one line each", () => {
    const { container } = render(
      <SectionHeader command="chapa score @developer" meta="composite 82 · high" />,
    );
    const spans = Array.from(container.querySelectorAll("span")).filter(
      (span) => span.className.includes("font-heading"),
    );
    expect(spans).toHaveLength(2);
    for (const span of spans) {
      expect(span.className).toContain("whitespace-nowrap");
    }
  });

  it("draws the rule under the row", () => {
    const { container } = render(<SectionHeader command="chapa features" />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("border-b");
    expect(row.className).toContain("border-stroke-strong");
  });

  it("exposes the real section name to assistive tech, not the command", () => {
    render(<SectionHeader command="chapa features" title="Features" />);
    const heading = screen.getByRole("heading", { name: "Features" });
    expect(heading.className).toContain("sr-only");
  });
});

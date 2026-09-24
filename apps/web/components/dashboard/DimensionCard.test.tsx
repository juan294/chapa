// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DimensionCard } from "./DimensionCard";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// #1335 phase 5 step 5.10 — DimensionCard's legacy branch (stats/craftResult/
// profileType/score props, SubMetricPanel) is deleted; receiptPresentation is
// the only presentation this component draws. These tests replace
// DimensionCard.test.tsx and DimensionCard.render.test.tsx, both of which
// tested only the retired legacy branch.
// ---------------------------------------------------------------------------

const presentation = (overrides: Partial<{ display: string | null; subtitle: string; detail: React.ReactNode }> = {}) => ({
  display: "85",
  subtitle: "PRs merged · issues closed · commits",
  detail: <p>Detail content</p>,
  ...overrides,
});

describe("DimensionCard", () => {
  it("renders dimension label and the receipt-presented display value", () => {
    render(<DimensionCard dimension="delivery" receiptPresentation={presentation({ display: "85" })} />);
    expect(screen.getByText("Delivery")).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
  });

  it("renders a progress bar sized to the display value when one exists", () => {
    render(<DimensionCard dimension="quality" receiptPresentation={presentation({ display: "72" })} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("72");
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
    const fill = progressbar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("72%");
  });

  it("omits the progress bar and shrinks the value text when the display is unavailable", () => {
    render(<DimensionCard dimension="craft" receiptPresentation={presentation({ display: null })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    const value = screen.getByText("Unavailable");
    expect(value.className).toContain("text-sm");
  });

  it("expand/collapse toggles the receipt detail's visibility", () => {
    render(<DimensionCard dimension="delivery" receiptPresentation={presentation()} />);
    expect(screen.queryByText("Detail content")).toBeNull();
    const expandButton = screen.getByRole("button", { expanded: false });
    fireEvent.click(expandButton);
    expect(screen.getByText("Detail content")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { expanded: true }));
    expect(screen.queryByText("Detail content")).toBeNull();
  });

  it("chevron rotates on expand", () => {
    const { container } = render(<DimensionCard dimension="delivery" receiptPresentation={presentation()} />);
    const chevron = container.querySelector("[data-testid='chevron-icon']") as HTMLElement;
    expect(chevron.getAttribute("class")).not.toContain("rotate-180");
    fireEvent.click(container.querySelector("[aria-expanded]") as HTMLElement);
    expect(chevron.getAttribute("class")).toContain("rotate-180");
  });

  it("keyboard Enter toggles expand", () => {
    render(<DimensionCard dimension="delivery" receiptPresentation={presentation()} />);
    const expandButton = screen.getByRole("button", { expanded: false });
    fireEvent.keyDown(expandButton, { key: "Enter" });
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { expanded: true }), { key: "Enter" });
    expect(screen.getByRole("button", { expanded: false })).toBeTruthy();
  });

  it("has correct ARIA attributes on the article, toggle and panel", () => {
    const { container } = render(<DimensionCard dimension="consistency" receiptPresentation={presentation({ display: "91" })} />);
    const article = screen.getByRole("article");
    expect(article.getAttribute("aria-label")).toBe("Consistency dimension score: 91");
    const expandButton = container.querySelector("[aria-expanded]") as HTMLElement;
    expect(expandButton.getAttribute("aria-expanded")).toBe("false");
    expect(expandButton.getAttribute("aria-controls")).toBe("dim-panel-consistency");
    expect(container.querySelector("#dim-panel-consistency")).toBeTruthy();
  });

  it("labels the article with the unavailable text when there is no display value", () => {
    render(<DimensionCard dimension="craft" receiptPresentation={presentation({ display: null })} />);
    const article = screen.getByRole("article");
    expect(article.getAttribute("aria-label")).toMatch(/unavailable/i);
  });

  // -------------------------------------------------------------------------
  // WCAG #667 — native button, not div[role=button]
  // -------------------------------------------------------------------------
  it("expand toggle is a native button element, not a div", () => {
    const { container } = render(<DimensionCard dimension="delivery" receiptPresentation={presentation()} />);
    expect(container.querySelector("div[role='button']")).toBeNull();
    const nativeButton = container.querySelector("button[aria-expanded]");
    expect(nativeButton).not.toBeNull();
    expect(nativeButton!.tagName.toLowerCase()).toBe("button");
  });

  it("progressbar container has aria-label with dimension name", () => {
    render(<DimensionCard dimension="delivery" receiptPresentation={presentation({ display: "85" })} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-label")).toBe("Delivery score");
  });

  it("uses tabular-nums for stable display", () => {
    render(<DimensionCard dimension="delivery" receiptPresentation={presentation({ display: "85" })} />);
    expect(screen.getByText("85").className).toContain("tabular-nums");
  });

  /**
   * WCAG 2.5.3 (label in name): the toggle's accessible name must contain
   * the text a sighted user reads on it (LE-8-3).
   */
  it.each(["delivery", "quality", "consistency", "breadth", "craft"] as const)(
    "%s toggle: accessible name includes the visible subtitle and still names the dimension",
    (dimension) => {
      render(<DimensionCard dimension={dimension} receiptPresentation={presentation()} />);
      const toggle = screen.getByRole("button", { expanded: false });
      const visibleText = toggle.textContent?.trim() ?? "";
      expect(visibleText.length).toBeGreaterThan(0);
      const name = toggle.getAttribute("aria-label") ?? visibleText;
      expect(name.toLowerCase()).toContain(visibleText.toLowerCase());
      expect(name).toMatch(/^Toggle .+ breakdown/);
    },
  );
});

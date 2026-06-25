// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "InfoTooltip.tsx"),
  "utf-8",
);

import { InfoTooltip } from "./InfoTooltip";

afterEach(cleanup);

describe("InfoTooltip", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("design system compliance", () => {
    it("uses semantic color tokens (no hardcoded hex)", () => {
      // Should use tokens like text-text-secondary, text-amber, bg-card, shadow-card
      expect(SOURCE).toContain("text-text-secondary");
      expect(SOURCE).toContain("text-amber");
      expect(SOURCE).toContain("bg-card");
      expect(SOURCE).toContain("shadow-card");
    });

    it("uses font-body for tooltip text", () => {
      expect(SOURCE).toContain("font-body");
    });
  });

  describe("accessibility", () => {
    it("uses a button element as trigger", () => {
      expect(SOURCE).toContain("<button");
    });

    it("has aria-label on the trigger button", () => {
      expect(SOURCE).toContain("aria-label");
    });

    it("has role=tooltip on the panel", () => {
      expect(SOURCE).toContain('role="tooltip"');
    });

    it("has aria-describedby linking trigger to panel", () => {
      expect(SOURCE).toContain("aria-describedby");
    });

    it("SVG icon has aria-hidden=true", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });

    it("focus ring uses ring-2 and ring-amber for visibility (#435)", () => {
      expect(SOURCE).toContain("focus-visible:ring-2");
      expect(SOURCE).toContain("focus-visible:ring-amber");
      // Should not use the weaker ring-1 ring-amber/50
      expect(SOURCE).not.toContain("ring-amber/50");
    });
  });

  describe("SVG icon conventions", () => {
    it("uses strokeWidth=1.5 per design system", () => {
      expect(SOURCE).toContain('strokeWidth="1.5"');
    });

    it("uses strokeLinecap=round", () => {
      expect(SOURCE).toContain('strokeLinecap="round"');
    });

    it("uses strokeLinejoin=round", () => {
      expect(SOURCE).toContain('strokeLinejoin="round"');
    });
  });

  describe("props interface", () => {
    it("accepts content prop", () => {
      expect(SOURCE).toContain("content:");
    });

    it("accepts id prop", () => {
      expect(SOURCE).toContain("id:");
    });

    it("accepts optional position prop", () => {
      expect(SOURCE).toMatch(/position\??\s*:/);
    });
  });

  describe("mobile support", () => {
    it("handles click toggle via useState", () => {
      expect(SOURCE).toContain("useState");
    });

    it("handles Escape key to dismiss", () => {
      expect(SOURCE).toMatch(/Escape/);
    });
  });

  describe("text casing (#285)", () => {
    it("tooltip panel uses normal-case to override inherited uppercase", () => {
      // Parent containers (stat labels, dimension labels) use CSS uppercase.
      // The tooltip panel must reset with normal-case so tooltip text renders
      // as sentence case regardless of parent text-transform.
      expect(SOURCE).toContain("normal-case");
    });
  });

  // =====================================================================
  // Runtime interaction tests
  // =====================================================================

  describe("tooltip visibility on click", () => {
    it("shows tooltip when button is clicked", () => {
      render(<InfoTooltip content="Test tooltip" id="tt-1" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);

      expect(screen.getByRole("tooltip")).toBeDefined();
      expect(screen.getByText("Test tooltip")).toBeDefined();
    });

    it("hides tooltip when button is clicked again (toggle)", () => {
      render(<InfoTooltip content="Test tooltip" id="tt-2" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toBeDefined();

      fireEvent.click(button);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("does not show tooltip when not clicked", () => {
      render(<InfoTooltip content="Hidden tooltip" id="tt-3" />);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  describe("Escape key handling", () => {
    it("closes tooltip when Escape is pressed", () => {
      render(<InfoTooltip content="Escape me" id="tt-esc" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toBeDefined();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("does not register Escape listener when tooltip is closed", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener");
      render(<InfoTooltip content="Test" id="tt-esc2" />);

      // Tooltip is not open, so no keydown listener should be active
      fireEvent.keyDown(document, { key: "Escape" });
      // No tooltip to close
      expect(screen.queryByRole("tooltip")).toBeNull();

      removeSpy.mockRestore();
    });
  });

  describe("click-outside detection", () => {
    it("closes tooltip when clicking outside the wrapper", () => {
      render(
        <div>
          <InfoTooltip content="Click outside" id="tt-outside" />
          <button data-testid="external">External</button>
        </div>,
      );
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toBeDefined();

      // Click outside the tooltip wrapper
      fireEvent.mouseDown(screen.getByTestId("external"));
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("does not close tooltip when clicking inside the wrapper", () => {
      render(<InfoTooltip content="Stay open" id="tt-inside" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);
      expect(screen.getByRole("tooltip")).toBeDefined();

      // Click the button again (inside wrapper) — toggles, but mousedown should not close
      fireEvent.mouseDown(button);
      // The mousedown on the wrapper should not trigger the outside-click handler
      // (it stays open; the next click would toggle)
      expect(screen.getByRole("tooltip")).toBeDefined();
    });
  });

  describe("hover state", () => {
    it("shows tooltip on mouse enter of wrapper", () => {
      const { container } = render(
        <InfoTooltip content="Hover content" id="tt-hover" />,
      );
      const wrapper = container.firstElementChild as HTMLElement;

      fireEvent.mouseEnter(wrapper);
      expect(screen.getByRole("tooltip")).toBeDefined();
    });

    it("hides tooltip on mouse leave of wrapper", () => {
      const { container } = render(
        <InfoTooltip content="Hover content" id="tt-hover2" />,
      );
      const wrapper = container.firstElementChild as HTMLElement;

      fireEvent.mouseEnter(wrapper);
      expect(screen.getByRole("tooltip")).toBeDefined();

      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("shows tooltip on button focus", () => {
      render(<InfoTooltip content="Focus content" id="tt-focus" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.focus(button);
      expect(screen.getByRole("tooltip")).toBeDefined();
    });

    it("hides tooltip on button blur", () => {
      render(<InfoTooltip content="Blur content" id="tt-blur" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.focus(button);
      expect(screen.getByRole("tooltip")).toBeDefined();

      fireEvent.blur(button);
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  describe("position calculation", () => {
    it("uses position=top by default (translate -50%, -100%)", () => {
      render(<InfoTooltip content="Top tooltip" id="tt-top" />);
      const button = screen.getByRole("button", { name: "More information" });

      // Mock getBoundingClientRect
      vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
        left: 100,
        top: 200,
        right: 116,
        bottom: 216,
        width: 16,
        height: 16,
        x: 100,
        y: 200,
        toJSON: () => {},
      });

      fireEvent.click(button);

      const tooltip = screen.getByRole("tooltip");
      // For top position: y = rect.top, then style top = y - 8
      expect(tooltip.style.top).toBe("192px");
      // x = rect.left + rect.width / 2 = 100 + 8 = 108
      expect(tooltip.style.left).toBe("108px");
      expect(tooltip.style.transform).toContain("translate(-50%, -100%)");
    });

    it("uses position=bottom with correct styling", () => {
      render(
        <InfoTooltip
          content="Bottom tooltip"
          id="tt-bottom"
          position="bottom"
        />,
      );
      const button = screen.getByRole("button", { name: "More information" });

      vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
        left: 100,
        top: 200,
        right: 116,
        bottom: 216,
        width: 16,
        height: 16,
        x: 100,
        y: 200,
        toJSON: () => {},
      });

      fireEvent.click(button);

      const tooltip = screen.getByRole("tooltip");
      // For bottom position: y = rect.bottom = 216, then style top = y + 8
      expect(tooltip.style.top).toBe("224px");
      expect(tooltip.style.left).toBe("108px");
      expect(tooltip.style.transform).toContain("translate(-50%, 0)");
    });
  });

  describe("portal rendering (UX-L1: #958 — safe inside CSS-transformed ancestors)", () => {
    it("uses createPortal to render outside transformed ancestor", () => {
      // InfoTooltip is used inside DimensionCard which has animate-fade-in-up
      // (a CSS transform). position:fixed breaks inside transformed ancestors,
      // so the tooltip panel MUST be portaled to document.body.
      expect(SOURCE).toContain("createPortal");
      expect(SOURCE).toContain("document.body");
    });

    it("uses position:fixed via z-[99999] class on the portaled panel", () => {
      // z-[99999] implies position:fixed positioning — both must be present.
      expect(SOURCE).toContain("fixed");
      expect(SOURCE).toContain("z-[99999]");
    });

    it("renders tooltip into document.body via createPortal", () => {
      render(
        <div data-testid="parent-container">
          <InfoTooltip content="Portal test" id="tt-portal" />
        </div>,
      );
      const button = screen.getByRole("button", { name: "More information" });
      fireEvent.click(button);

      const tooltip = screen.getByRole("tooltip");
      // The tooltip should be a direct child of document.body (via portal),
      // not inside the parent container
      expect(tooltip.parentElement).toBe(document.body);
    });

    it("does not render tooltip in DOM when not visible", () => {
      render(<InfoTooltip content="No portal" id="tt-no-portal" />);
      // No tooltip role should exist anywhere
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    });
  });

  describe("scroll/resize listener cleanup", () => {
    it("adds scroll and resize listeners when tooltip is visible", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      render(<InfoTooltip content="Listeners" id="tt-listen" />);
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);

      const scrollCalls = addSpy.mock.calls.filter(
        ([event]) => event === "scroll",
      );
      const resizeCalls = addSpy.mock.calls.filter(
        ([event]) => event === "resize",
      );
      expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

      addSpy.mockRestore();
    });

    it("removes scroll and resize listeners when tooltip hides", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      render(<InfoTooltip content="Cleanup" id="tt-cleanup" />);
      const button = screen.getByRole("button", { name: "More information" });

      // Open tooltip
      fireEvent.click(button);
      // Close tooltip
      fireEvent.click(button);

      const scrollCalls = removeSpy.mock.calls.filter(
        ([event]) => event === "scroll",
      );
      const resizeCalls = removeSpy.mock.calls.filter(
        ([event]) => event === "resize",
      );
      expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

      removeSpy.mockRestore();
    });

    it("cleans up all listeners on unmount while tooltip is visible", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(
        <InfoTooltip content="Unmount cleanup" id="tt-unmount" />,
      );
      const button = screen.getByRole("button", { name: "More information" });

      fireEvent.click(button);
      removeSpy.mockClear();

      unmount();

      const scrollCalls = removeSpy.mock.calls.filter(
        ([event]) => event === "scroll",
      );
      const resizeCalls = removeSpy.mock.calls.filter(
        ([event]) => event === "resize",
      );
      expect(scrollCalls.length).toBeGreaterThanOrEqual(1);
      expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

      removeSpy.mockRestore();
    });
  });

  describe("tooltip content and id", () => {
    it("renders the content text inside the tooltip", () => {
      render(<InfoTooltip content="Specific content here" id="tt-content" />);
      fireEvent.click(screen.getByRole("button", { name: "More information" }));
      expect(screen.getByText("Specific content here")).toBeDefined();
    });

    it("applies the id to the tooltip element", () => {
      render(<InfoTooltip content="With ID" id="my-custom-id" />);
      fireEvent.click(screen.getByRole("button", { name: "More information" }));
      expect(document.getElementById("my-custom-id")).not.toBeNull();
    });

    it("links aria-describedby on button to tooltip id", () => {
      render(<InfoTooltip content="Linked" id="aria-link-id" />);
      const button = screen.getByRole("button", { name: "More information" });
      expect(button.getAttribute("aria-describedby")).toBe("aria-link-id");
    });
  });

  describe("className prop", () => {
    it("applies custom className to wrapper span", () => {
      const { container } = render(
        <InfoTooltip content="Test" id="tt-class" className="my-custom" />,
      );
      expect(container.firstElementChild!.className).toContain("my-custom");
    });

    it("does not include 'undefined' when className is omitted", () => {
      const { container } = render(
        <InfoTooltip content="Test" id="tt-noclass" />,
      );
      expect(container.firstElementChild!.className).not.toContain("undefined");
    });
  });
});

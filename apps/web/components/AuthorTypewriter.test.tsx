// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AuthorTypewriter.tsx"),
  "utf-8",
);

// ---------- jsdom runtime tests ----------

// Mock matchMedia before importing the component
const matchMediaMock = vi.fn().mockReturnValue({ matches: false });
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
});

import { AuthorTypewriter } from "./AuthorTypewriter";

beforeEach(() => {
  vi.useFakeTimers();
  matchMediaMock.mockReturnValue({ matches: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AuthorTypewriter", () => {
  describe("client component", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("accessibility", () => {
    it("has aria-label on trigger pill", () => {
      expect(SOURCE).toContain("aria-label=");
    });

    it("social links have aria-label attributes", () => {
      expect(SOURCE).toContain('aria-label={link.label}');
    });

    it("decorative SVGs are aria-hidden", () => {
      expect(SOURCE).toContain('aria-hidden="true"');
    });

    it("outer wrapper has role=presentation for onClick semantics (#423)", () => {
      // The outer div has onClick={e => e.stopPropagation()} which requires
      // a role attribute to satisfy a11y linting (no static element with handlers)
      expect(SOURCE).toContain('role="presentation"');
    });
  });

  describe("keyboard accessibility (#219)", () => {
    it("popover becomes visible on focus-within (not just hover)", () => {
      // The popover container must use group-focus-within: alongside group-hover:
      // to make social links reachable by keyboard
      expect(SOURCE).toContain("group-focus-within:opacity-100");
    });

    it("popover becomes interactive on focus-within (pointer-events)", () => {
      // pointer-events must be auto on focus-within so links are clickable/tabbable
      expect(SOURCE).toContain("group-focus-within:pointer-events-auto");
    });

    it("popover translates into position on focus-within", () => {
      expect(SOURCE).toContain("group-focus-within:translate-y-0");
    });

    it("popover scales to full size on focus-within", () => {
      expect(SOURCE).toContain("group-focus-within:scale-100");
    });

    it("trigger pill is a button element (natively focusable)", () => {
      expect(SOURCE).toContain('<button');
      expect(SOURCE).toContain('type="button"');
    });
  });

  describe("existing hover behavior preserved", () => {
    it("still has group-hover:opacity-100", () => {
      expect(SOURCE).toContain("group-hover:opacity-100");
    });

    it("still has group-hover:pointer-events-auto", () => {
      expect(SOURCE).toContain("group-hover:pointer-events-auto");
    });

    it("still has group-hover:translate-y-0", () => {
      expect(SOURCE).toContain("group-hover:translate-y-0");
    });

    it("still has group-hover:scale-100", () => {
      expect(SOURCE).toContain("group-hover:scale-100");
    });
  });

  describe("rendering", () => {
    it("renders the home text initially", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByText("</> JG")).toBeDefined();
    });

    it("renders all social links with correct hrefs", () => {
      render(<AuthorTypewriter />);
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(4);
      expect(links[0]!.getAttribute("href")).toContain("x.com");
      expect(links[1]!.getAttribute("href")).toContain("linkedin.com");
      expect(links[2]!.getAttribute("href")).toContain("medium.com");
      expect(links[3]!.getAttribute("href")).toContain("github.com");
    });

    it("renders author name in popover", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByText("Juan González")).toBeDefined();
    });

    it("applies custom className to root element", () => {
      const { container } = render(<AuthorTypewriter className="custom-class" />);
      expect(container.firstElementChild!.className).toContain("custom-class");
    });

    it("renders without className when not provided", () => {
      const { container } = render(<AuthorTypewriter />);
      // Should not contain "undefined" in the className
      expect(container.firstElementChild!.className).not.toContain("undefined");
    });

    it("social links open in new tab", () => {
      render(<AuthorTypewriter />);
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
      });
    });

    it("renders blinking cursor element", () => {
      const { container } = render(<AuthorTypewriter />);
      const cursor = container.querySelector(".animate-cursor-blink");
      expect(cursor).not.toBeNull();
      expect(cursor!.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("animation cycle", () => {
    it("starts the typewriter cycle after HOME_HOLD (30s)", async () => {
      render(<AuthorTypewriter />);
      const textSpan = screen.getByText("</> JG");

      // Advance past the HOME_HOLD period (must use async for promise resolution)
      await vi.advanceTimersByTimeAsync(30_000);

      // The cycle should start erasing HOME_TEXT character by character
      // After one CHAR_DELAY (80ms), text should lose one character
      await vi.advanceTimersByTimeAsync(80);
      // Text should now be shorter (erasing in progress)
      expect(textSpan.textContent!.length).toBeLessThan(6);
    });

    it("skips animation when prefers-reduced-motion is set", async () => {
      matchMediaMock.mockReturnValue({ matches: true });
      render(<AuthorTypewriter />);
      const textSpan = screen.getByText("</> JG");

      // Advance well past HOME_HOLD — text should remain unchanged
      await vi.advanceTimersByTimeAsync(60_000);
      expect(textSpan.textContent).toBe("</> JG");
    });

    it("cleans up timeouts on unmount", async () => {
      const { unmount } = render(<AuthorTypewriter />);
      // Start advancing to create pending timeouts
      await vi.advanceTimersByTimeAsync(1000);
      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it("erases and types next message after HOME_HOLD", async () => {
      render(<AuthorTypewriter />);
      const textSpan = screen.getByText("</> JG");

      // HOME_TEXT is "</> JG" = 6 chars
      // eraseText loop: i goes from 6 to 0 (7 iterations), waits when i>0 = 6 waits
      // Advance through HOME_HOLD
      await vi.advanceTimersByTimeAsync(30_000);

      // Erase "</> JG" — 6 waits * 80ms = 480ms
      await vi.advanceTimersByTimeAsync(6 * 80);

      // After erase, should be empty
      expect(textSpan.textContent).toBe("");

      // Advance through EMPTY_PAUSE (300ms)
      await vi.advanceTimersByTimeAsync(300);

      // Now typing the next message: "built with ♥ in the EU" (22 chars)
      // typeText loop: i goes from 0 to 22 (23 iterations), waits when i<22 = 22 waits
      // After typing some chars, text should start appearing
      await vi.advanceTimersByTimeAsync(5 * 80);
      expect(textSpan.textContent!.length).toBeGreaterThan(0);
      expect(textSpan.textContent!.startsWith("built")).toBe(true);
    });

    it("skips index 0 when cycling (never re-types HOME_TEXT as a message)", async () => {
      render(<AuthorTypewriter />);
      const textSpan = screen.getByText("</> JG");

      // Advance past HOME_HOLD
      await vi.advanceTimersByTimeAsync(30_000);

      // Erase HOME_TEXT — 6 waits * 80ms
      await vi.advanceTimersByTimeAsync(6 * 80);

      // EMPTY_PAUSE
      await vi.advanceTimersByTimeAsync(300);

      // Type the first message fully (index 1: "built with ♥ in the EU" = 22 chars)
      // Need 22 waits (CHAR_DELAY each) to type 22 chars (i < text.length for 0..21)
      await vi.advanceTimersByTimeAsync(22 * 80);

      // Should be the first rotating message, not HOME_TEXT
      expect(textSpan.textContent).toBe("built with ♥ in the EU");
    });
  });

  describe("event handlers", () => {
    it("stops propagation on click", () => {
      const { container } = render(<AuthorTypewriter />);
      const rootDiv = container.firstElementChild as HTMLElement;
      const stopPropagation = vi.fn();
      fireEvent.click(rootDiv, { stopPropagation });
      // Verify the handler is present by checking it doesn't bubble
      // (fireEvent doesn't pass our mock, so we check via the event object)
      const event = new MouseEvent("click", { bubbles: true });
      vi.spyOn(event, "stopPropagation");
      rootDiv.dispatchEvent(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("stops propagation on Enter keydown", () => {
      const { container } = render(<AuthorTypewriter />);
      const rootDiv = container.firstElementChild as HTMLElement;
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      });
      vi.spyOn(event, "stopPropagation");
      rootDiv.dispatchEvent(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("stops propagation on Space keydown", () => {
      const { container } = render(<AuthorTypewriter />);
      const rootDiv = container.firstElementChild as HTMLElement;
      const event = new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
      });
      vi.spyOn(event, "stopPropagation");
      rootDiv.dispatchEvent(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("does not stop propagation on other keys", () => {
      const { container } = render(<AuthorTypewriter />);
      const rootDiv = container.firstElementChild as HTMLElement;
      const event = new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
      });
      vi.spyOn(event, "stopPropagation");
      rootDiv.dispatchEvent(event);
      expect(event.stopPropagation).not.toHaveBeenCalled();
    });
  });
});

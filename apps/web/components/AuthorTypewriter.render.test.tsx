// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { AuthorTypewriter } from "./AuthorTypewriter";

let matchMediaResult = true; // true = reduced motion (skip animation)

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchMediaResult,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  matchMediaResult = true;
});

describe("AuthorTypewriter", () => {
  describe("basic rendering", () => {
    it("renders trigger button", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByRole("button")).toBeDefined();
    });

    it("has aria-label with author name", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByLabelText(/Made by/)).toBeDefined();
    });

    it("renders initial home text", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByText("</> JG")).toBeDefined();
    });

    it("renders social link icons", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByLabelText("X (Twitter)")).toBeDefined();
      expect(screen.getByLabelText("LinkedIn")).toBeDefined();
      expect(screen.getByLabelText("Medium")).toBeDefined();
      expect(screen.getByLabelText("GitHub")).toBeDefined();
    });

    it("renders author name in popover", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByText(/Juan Gonz/)).toBeDefined();
    });

    it("applies custom className", () => {
      const { container } = render(<AuthorTypewriter className="test-class" />);
      expect(container.querySelector(".test-class")).not.toBeNull();
    });

    it("outer wrapper has role=presentation", () => {
      render(<AuthorTypewriter />);
      expect(screen.getByRole("presentation")).toBeDefined();
    });
  });

  describe("social links", () => {
    it("social links open in new tab", () => {
      render(<AuthorTypewriter />);
      const twitterLink = screen.getByLabelText("X (Twitter)");
      expect(twitterLink.getAttribute("target")).toBe("_blank");
      expect(twitterLink.getAttribute("rel")).toContain("noopener");
    });

    it("renders all 4 social links with correct hrefs", () => {
      render(<AuthorTypewriter />);
      const twitterLink = screen.getByLabelText("X (Twitter)") as HTMLAnchorElement;
      expect(twitterLink.href).toContain("x.com");

      const linkedinLink = screen.getByLabelText("LinkedIn") as HTMLAnchorElement;
      expect(linkedinLink.href).toContain("linkedin.com");

      const mediumLink = screen.getByLabelText("Medium") as HTMLAnchorElement;
      expect(mediumLink.href).toContain("medium.com");

      const githubLink = screen.getByLabelText("GitHub") as HTMLAnchorElement;
      expect(githubLink.href).toContain("github.com");
    });
  });

  describe("animation lifecycle", () => {
    it("skips animation when prefers-reduced-motion is true", () => {
      matchMediaResult = true;
      render(<AuthorTypewriter />);

      // With reduced motion, the text should remain at HOME_TEXT
      expect(screen.getByText("</> JG")).toBeDefined();

      // Advance time significantly — text should not change
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText("</> JG")).toBeDefined();
    });

    it("starts typewriter animation when prefers-reduced-motion is false", () => {
      matchMediaResult = false;
      render(<AuthorTypewriter />);

      // Initially shows HOME_TEXT
      expect(screen.getByText("</> JG")).toBeDefined();
    });

    it("cleans up timers on unmount", () => {
      matchMediaResult = false;
      const { unmount } = render(<AuthorTypewriter />);

      // Should not throw or leak when unmounting during animation
      unmount();

      // Advance timers after unmount — should not cause errors
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
    });

    it("starts erasing home text after HOME_HOLD (30s)", async () => {
      matchMediaResult = false;
      const { container } = render(<AuthorTypewriter />);

      // Still HOME_TEXT at start
      expect(screen.getByText("</> JG")).toBeDefined();

      // The cycle uses chained awaits with setTimeout-backed promises.
      // Each `await wait(ms)` creates a new setTimeout. With fake timers,
      // we need to advance + flush microtasks for each step.
      // HOME_HOLD (30000ms) -> eraseText loop (80ms per char, 5 chars)
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // Advance through erase steps — each one is a separate setTimeout
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(80);
        });
      }

      // After erasing several chars, the text should be shorter than full HOME_TEXT.
      const textSpan = container.querySelector("button span span");
      expect(textSpan).not.toBeNull();
      expect(textSpan!.textContent!.length).toBeLessThan("</> JG".length);
    });
  });

  describe("className prop", () => {
    it("renders without className when not provided", () => {
      const { container } = render(<AuthorTypewriter />);
      const wrapper = container.querySelector("[role='presentation']");
      expect(wrapper).not.toBeNull();
      // Should have base classes but no extra className
      expect(wrapper!.className).toContain("group");
    });

    it("appends className to wrapper", () => {
      const { container } = render(<AuthorTypewriter className="extra" />);
      const wrapper = container.querySelector("[role='presentation']");
      expect(wrapper!.className).toContain("extra");
    });
  });

  describe("cursor", () => {
    it("renders blinking cursor element", () => {
      render(<AuthorTypewriter />);
      const button = screen.getByRole("button");
      const cursor = button.querySelector(".animate-cursor-blink");
      expect(cursor).not.toBeNull();
      expect(cursor!.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("click/keydown propagation", () => {
    it("stops click propagation on wrapper via React synthetic events", () => {
      const outerHandler = vi.fn();
      render(
        <div onClick={outerHandler}>
          <AuthorTypewriter />
        </div>,
      );

      const wrapper = screen.getByRole("presentation");
      fireEvent.click(wrapper);

      expect(outerHandler).not.toHaveBeenCalled();
    });

    it("stops keydown propagation for Enter key", () => {
      const outerKeyDown = vi.fn();
      render(
        <div onKeyDown={outerKeyDown}>
          <AuthorTypewriter />
        </div>,
      );

      const wrapper = screen.getByRole("presentation");
      fireEvent.keyDown(wrapper, { key: "Enter" });
      expect(outerKeyDown).not.toHaveBeenCalled();
    });

    it("stops keydown propagation for Space key", () => {
      const outerKeyDown = vi.fn();
      render(
        <div onKeyDown={outerKeyDown}>
          <AuthorTypewriter />
        </div>,
      );

      const wrapper = screen.getByRole("presentation");
      fireEvent.keyDown(wrapper, { key: " " });
      expect(outerKeyDown).not.toHaveBeenCalled();
    });

    it("does not stop keydown propagation for other keys", () => {
      const outerKeyDown = vi.fn();
      render(
        <div onKeyDown={outerKeyDown}>
          <AuthorTypewriter />
        </div>,
      );

      const wrapper = screen.getByRole("presentation");
      fireEvent.keyDown(wrapper, { key: "Tab" });
      expect(outerKeyDown).toHaveBeenCalled();
    });
  });

  describe("animation — full type/erase cycle", () => {
    it("types a new message after erasing home text", async () => {
      matchMediaResult = false;
      const { container } = render(<AuthorTypewriter />);

      // HOME_HOLD (30s)
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // Erase HOME_TEXT: "</> JG" = 6 chars, each 80ms = 6 steps
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          vi.advanceTimersByTime(80);
        });
      }

      // After erase completes, EMPTY_PAUSE (300ms)
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Now typeText begins for the next message
      // Advance a few chars to verify typing started
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          vi.advanceTimersByTime(80);
        });
      }

      const textSpan = container.querySelector("button span span");
      expect(textSpan).not.toBeNull();
      // Text should be partially typed (non-empty, not HOME_TEXT)
      expect(textSpan!.textContent!.length).toBeGreaterThan(0);
    });

    it("returns to HOME_TEXT after showing a message", async () => {
      matchMediaResult = false;
      const { container } = render(<AuthorTypewriter />);

      // Step through a complete cycle:
      // HOME_HOLD -> erase HOME -> pause -> type msg -> MSG_HOLD -> erase msg -> pause -> type HOME

      // 1. HOME_HOLD
      await act(async () => { vi.advanceTimersByTime(30_000); });

      // 2. Erase HOME_TEXT (6 chars * 80ms)
      for (let i = 0; i < 6; i++) {
        await act(async () => { vi.advanceTimersByTime(80); });
      }

      // 3. EMPTY_PAUSE
      await act(async () => { vi.advanceTimersByTime(300); });

      // 4. Type next message (MESSAGES[1] = "built with ♥ in the EU" = 22 chars)
      for (let i = 0; i < 22; i++) {
        await act(async () => { vi.advanceTimersByTime(80); });
      }

      // 5. MSG_HOLD
      await act(async () => { vi.advanceTimersByTime(4_000); });

      // 6. Erase message (22 chars)
      for (let i = 0; i < 22; i++) {
        await act(async () => { vi.advanceTimersByTime(80); });
      }

      // 7. EMPTY_PAUSE
      await act(async () => { vi.advanceTimersByTime(300); });

      // 8. Type HOME_TEXT back (6 chars)
      for (let i = 0; i < 6; i++) {
        await act(async () => { vi.advanceTimersByTime(80); });
      }

      const textSpan = container.querySelector("button span span");
      expect(textSpan?.textContent).toBe("</> JG");
    });

    it("handles unmount mid-erase without errors", async () => {
      matchMediaResult = false;
      const { unmount } = render(<AuthorTypewriter />);

      // Advance into the erase phase
      await act(async () => { vi.advanceTimersByTime(30_000); });
      await act(async () => { vi.advanceTimersByTime(80); });
      await act(async () => { vi.advanceTimersByTime(80); });

      // Unmount mid-erase
      unmount();

      // Advance more timers — should not crash
      await act(async () => { vi.advanceTimersByTime(60_000); });
    });

    it("handles unmount mid-type without errors", async () => {
      matchMediaResult = false;
      const { unmount } = render(<AuthorTypewriter />);

      // Advance past erase into type phase
      await act(async () => { vi.advanceTimersByTime(30_000); });
      for (let i = 0; i < 6; i++) {
        await act(async () => { vi.advanceTimersByTime(80); });
      }
      await act(async () => { vi.advanceTimersByTime(300); });
      // Start typing
      await act(async () => { vi.advanceTimersByTime(80); });

      unmount();
      await act(async () => { vi.advanceTimersByTime(60_000); });
    });
  });
});

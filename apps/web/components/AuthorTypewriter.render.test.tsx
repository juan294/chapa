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

      // Use fireEvent.click which dispatches through React's synthetic event system
      // where stopPropagation works as expected.
      const wrapper = screen.getByRole("presentation");
      fireEvent.click(wrapper);

      // The wrapper's onClick calls e.stopPropagation(), so outerHandler should
      // NOT be called because the event doesn't bubble past the wrapper.
      expect(outerHandler).not.toHaveBeenCalled();
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { LoginCtaButton } from "./LoginCtaButton";

afterEach(() => {
  cleanup();
});

describe("LoginCtaButton", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it("renders an anchor pointing at the OAuth login endpoint", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });
    expect(link.getAttribute("href")).toBe("/api/auth/login");
  });

  it("shows the idle label before click", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    expect(screen.getByText("Get your badge")).toBeDefined();
    expect(screen.queryByText("Connecting…")).toBeNull();
  });

  // ─── Pending state (#770) ─────────────────────────────────────────────

  it("swaps to the pending label on click", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });

    act(() => {
      fireEvent.click(link);
    });

    // Appears in both the visible label and the sr-only live region.
    expect(screen.getAllByText("Connecting…").length).toBeGreaterThan(0);
  });

  it("marks the control as busy (aria-busy) once pending", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });

    expect(link.getAttribute("aria-busy")).toBe("false");

    act(() => {
      fireEvent.click(link);
    });

    expect(link.getAttribute("aria-busy")).toBe("true");
  });

  it("disables further interaction after the first click (aria-disabled + tabIndex)", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });

    act(() => {
      fireEvent.click(link);
    });

    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.getAttribute("tabindex")).toBe("-1");
  });

  it("prevents navigation on a second click while pending", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });

    act(() => {
      fireEvent.click(link);
    });

    const secondClick = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      link.dispatchEvent(secondClick);
    });

    expect(secondClick.defaultPrevented).toBe(true);
  });

  it("announces the pending state politely for screen readers", () => {
    const { container } = render(
      <LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />,
    );
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
  });

  // ─── Contrast (#1167 / UX-H1) ───────────────────────────────────────
  // White text on bg-amber (#8B5CF6) measures 4.06:1 — below the 4.5:1 AA
  // floor for normal text. bg-amber-dark (#7C3AED) measures ~5.4:1. The
  // --color-amber token itself must NOT change (used non-textually for
  // pills/heatmap/focus rings across the app); the fix is scoped to this
  // white-text-on-solid-fill call site only, re-anchoring the hover ramp
  // one step darker (base amber-dark, hover amber) so hover no longer lands
  // on amber-light (2.72:1).
  it("uses bg-amber-dark (not bare bg-amber) as the base fill for AA contrast", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });
    const classes = link.className.split(/\s+/);
    expect(classes).toContain("bg-amber-dark");
    expect(classes).not.toContain("bg-amber");
  });

  it("hovers to bg-amber (not bg-amber-light, 2.72:1) — one step darker than before", () => {
    render(<LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />);
    const link = screen.getByRole("link", { name: /Get your badge/ });
    const classes = link.className.split(/\s+/);
    expect(classes).toContain("hover:bg-amber");
    expect(classes).not.toContain("hover:bg-amber-light");
  });

  it("respects prefers-reduced-motion on the spinner (motion-reduce class present)", () => {
    const { container } = render(
      <LoginCtaButton label="Get your badge" pendingLabel="Connecting…" />,
    );
    const link = screen.getByRole("link", { name: /Get your badge/ });
    act(() => {
      fireEvent.click(link);
    });
    const spinner = container.querySelector("[data-spinner]");
    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute("class")).toContain("motion-reduce:animate-none");
  });
});

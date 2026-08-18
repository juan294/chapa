// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

// KeyboardShortcutsListener (mounted unconditionally by CommandBarHint, #1068)
// calls useRouter() — needs an app-router context that isn't present in tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the heavy command bar so this test focuses on disclosure behavior.
vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: ({ isAdmin }: { isAdmin?: boolean }) => (
    <div data-testid="global-command-bar" data-admin={isAdmin ? "true" : "false"}>
      <input id="terminal-command-input" aria-label="Terminal command input" />
    </div>
  ),
}));

import { CommandBarHint } from "./CommandBarHint";

afterEach(cleanup);

describe("CommandBarHint — progressive disclosure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a discoverable hint chip by default and does NOT mount the command bar", () => {
    render(<CommandBarHint />);
    expect(screen.getByTestId("command-bar-hint")).toBeDefined();
    expect(screen.queryByTestId("global-command-bar")).toBeNull();
  });

  it("the hint chip mentions the / shortcut", () => {
    render(<CommandBarHint />);
    const chip = screen.getByTestId("command-bar-hint");
    // The hint should reference the "/" key as the trigger.
    expect(chip.textContent).toContain("/");
  });

  it("the hint chip has an accessible label", () => {
    render(<CommandBarHint />);
    const chip = screen.getByTestId("command-bar-hint");
    expect(chip.getAttribute("aria-label")).toBeTruthy();
  });

  it("summons the command bar when the hint chip is clicked, and hides the chip", () => {
    render(<CommandBarHint />);
    fireEvent.click(screen.getByTestId("command-bar-hint"));
    expect(screen.getByTestId("global-command-bar")).toBeDefined();
    expect(screen.queryByTestId("command-bar-hint")).toBeNull();
  });

  it("summons the command bar when the user presses '/'", () => {
    render(<CommandBarHint />);
    expect(screen.queryByTestId("global-command-bar")).toBeNull();
    act(() => {
      fireEvent.keyDown(document, { key: "/" });
    });
    expect(screen.getByTestId("global-command-bar")).toBeDefined();
  });

  // Regression: focus routing after summon relies on the stable
  // #terminal-command-input id selector, not the (now-translatable)
  // aria-label. See KeyboardShortcutsListener/GlobalCommandBar/StudioClient
  // for the sibling selectors that share this contract.
  it("moves focus into the terminal input after being summoned via '/'", () => {
    render(<CommandBarHint />);
    act(() => {
      fireEvent.keyDown(document, { key: "/" });
    });
    const input = document.querySelector<HTMLInputElement>(
      "#terminal-command-input",
    );
    expect(input).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(document.activeElement).toBe(input);
  });

  it("does NOT summon when '/' is typed inside a text input", () => {
    render(
      <>
        <input data-testid="some-field" />
        <CommandBarHint />
      </>,
    );
    const field = screen.getByTestId("some-field");
    field.focus();
    act(() => {
      fireEvent.keyDown(field, { key: "/" });
    });
    expect(screen.queryByTestId("global-command-bar")).toBeNull();
    // Hint stays visible since the bar was not summoned.
    expect(screen.getByTestId("command-bar-hint")).toBeDefined();
  });

  it("forwards the isAdmin prop to the summoned command bar", () => {
    render(<CommandBarHint isAdmin />);
    fireEvent.click(screen.getByTestId("command-bar-hint"));
    const bar = screen.getByTestId("global-command-bar");
    expect(bar.getAttribute("data-admin")).toBe("true");
  });

  it("only attaches the global '/' listener while the chip is visible (no double-summon)", () => {
    render(<CommandBarHint />);
    act(() => {
      fireEvent.keyDown(document, { key: "/" });
    });
    expect(screen.getByTestId("global-command-bar")).toBeDefined();
    // A second '/' after the bar is mounted must not throw or re-summon a duplicate.
    act(() => {
      fireEvent.keyDown(document, { key: "/" });
    });
    expect(screen.getAllByTestId("global-command-bar")).toHaveLength(1);
  });
});

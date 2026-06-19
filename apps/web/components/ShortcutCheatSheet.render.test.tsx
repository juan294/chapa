// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ShortcutCheatSheet } from "./ShortcutCheatSheet";

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => true),
}));

import { isStudioEnabledSync } from "@/lib/feature-flags-sync";

beforeEach(() => {
  vi.mocked(isStudioEnabledSync).mockReturnValue(true);
});

afterEach(cleanup);

describe("ShortcutCheatSheet", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <ShortcutCheatSheet open={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when open", () => {
    render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("shows heading", () => {
    render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
  });

  it("shows close button", () => {
    render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Close keyboard shortcuts")).toBeDefined();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<ShortcutCheatSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close keyboard shortcuts"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on backdrop click", () => {
    const onClose = vi.fn();
    render(<ShortcutCheatSheet open={true} onClose={onClose} />);
    // Click on the backdrop (outermost presentation div)
    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ShortcutCheatSheet open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows scope group headings", () => {
    render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Navigation")).toBeDefined();
    expect(screen.getByText("Share Page")).toBeDefined();
    expect(screen.getByText("Studio")).toBeDefined();
  });

  it("shows footer hint about ? key", () => {
    render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/toggle this panel/)).toBeDefined();
  });

  describe("focus trap (lines 36-60)", () => {
    it("auto-focuses close button on open", () => {
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
      const closeBtn = screen.getByLabelText("Close keyboard shortcuts");
      expect(document.activeElement).toBe(closeBtn);
    });

    it("traps Tab at the last focusable element, cycling to the first", () => {
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
      const dialog = screen.getByRole("dialog");

      const focusable = Array.from(
        dialog.querySelectorAll(
          'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];
      expect(focusable.length).toBeGreaterThan(0);

      const last = focusable[focusable.length - 1]!;
      last.focus();
      expect(document.activeElement).toBe(last);

      // Tab from the last element should cycle to the first
      fireEvent.keyDown(document, { key: "Tab" });

      const first = focusable[0]!;
      expect(document.activeElement).toBe(first);
    });

    it("traps Shift+Tab at the first focusable element, cycling to the last", () => {
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
      const dialog = screen.getByRole("dialog");

      const focusable = Array.from(
        dialog.querySelectorAll(
          'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];
      expect(focusable.length).toBeGreaterThan(0);

      const first = focusable[0]!;
      first.focus();
      expect(document.activeElement).toBe(first);

      // Shift+Tab from the first element should cycle to the last
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

      const last = focusable[focusable.length - 1]!;
      expect(document.activeElement).toBe(last);
    });

    it("does not interfere with non-Tab keys", () => {
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);
      const closeBtn = screen.getByLabelText("Close keyboard shortcuts");
      closeBtn.focus();

      // Press a random key — should not change focus
      fireEvent.keyDown(document, { key: "a" });
      expect(document.activeElement).toBe(closeBtn);
    });
  });

  describe("studio disabled filtering (line 78)", () => {
    it("hides studio shortcuts when studio is disabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(false);
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);

      // Studio group heading should not appear
      expect(screen.queryByText("Studio")).toBeNull();

      // Navigation and Share Page should still be present
      expect(screen.getByText("Navigation")).toBeDefined();
      expect(screen.getByText("Share Page")).toBeDefined();
    });

    it("filters out go-studio shortcut when studio is disabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(false);
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);

      // "Go to Studio" label should not appear
      expect(screen.queryByText("Go to Studio")).toBeNull();
    });

    it("shows studio shortcuts when studio is enabled", () => {
      vi.mocked(isStudioEnabledSync).mockReturnValue(true);
      render(<ShortcutCheatSheet open={true} onClose={vi.fn()} />);

      expect(screen.getByText("Studio")).toBeDefined();
      expect(screen.getByText("Go to Studio")).toBeDefined();
    });
  });

  describe("backdrop click precision", () => {
    it("does not close when clicking inside the dialog (not backdrop)", () => {
      const onClose = vi.fn();
      render(<ShortcutCheatSheet open={true} onClose={onClose} />);
      // Click on the dialog panel itself (not the backdrop)
      fireEvent.click(screen.getByRole("dialog"));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ShortcutCheatSheet } from "./ShortcutCheatSheet";

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabledSync: () => true,
}));

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
});

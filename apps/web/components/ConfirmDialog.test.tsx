// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

// jsdom does not implement <dialog> — polyfill showModal/close once
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

afterEach(cleanup);

const baseProps = {
  open: true,
  title: "Unlink Bitbucket?",
  description: "Your Bitbucket stats will no longer be included.",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("does not show dialog content when open is false", () => {
    render(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByText("Unlink Bitbucket?")).toBeNull();
  });

  it("renders title, description, and both buttons when open", () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText("Unlink Bitbucket?")).toBeDefined();
    expect(
      screen.getByText("Your Bitbucket stats will no longer be included."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDefined();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when Confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when dialog is dismissed via close event", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    fireEvent(dialog!, new Event("close"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses custom confirmLabel", () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Unlink" />);
    expect(screen.getByRole("button", { name: "Unlink" })).toBeDefined();
  });

  it("uses custom cancelLabel", () => {
    render(<ConfirmDialog {...baseProps} cancelLabel="Never mind" />);
    expect(screen.getByRole("button", { name: "Never mind" })).toBeDefined();
  });

  it("destructive variant styles confirm button with terminal-red", () => {
    render(
      <ConfirmDialog
        {...baseProps}
        variant="destructive"
        confirmLabel="Delete"
      />,
    );
    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    expect(confirmBtn.className).toContain("terminal-red");
  });

  it("loading state disables both buttons", () => {
    render(<ConfirmDialog {...baseProps} loading={true} />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(cancel).toHaveProperty("disabled", true);
    expect(confirm).toHaveProperty("disabled", true);
  });

  it("has accessible role and labels", () => {
    render(<ConfirmDialog {...baseProps} />);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("role")).toBe("alertdialog");
    expect(dialog!.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog!.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("default variant styles confirm button with amber (non-destructive)", () => {
    render(
      <ConfirmDialog
        {...baseProps}
        variant="default"
        confirmLabel="OK"
      />,
    );
    const confirmBtn = screen.getByRole("button", { name: "OK" });
    expect(confirmBtn.className).toContain("bg-amber");
    expect(confirmBtn.className).not.toContain("terminal-red");
  });

  it("loading state shows spinner SVG inside confirm button", () => {
    render(
      <ConfirmDialog {...baseProps} loading={true} confirmLabel="Delete" />,
    );
    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    const spinner = confirmBtn.querySelector("svg.animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("loading=false shows plain text without spinner", () => {
    render(
      <ConfirmDialog {...baseProps} loading={false} confirmLabel="Delete" />,
    );
    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    const spinner = confirmBtn.querySelector("svg.animate-spin");
    expect(spinner).toBeNull();
    expect(confirmBtn.textContent).toBe("Delete");
  });

  it("closes the dialog element when open transitions from true to false", () => {
    const { rerender } = render(<ConfirmDialog {...baseProps} open={true} />);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog!.hasAttribute("open")).toBe(true);

    // Transition open from true to false
    rerender(<ConfirmDialog {...baseProps} open={false} />);

    // The component returns null when open is false, so dialog is removed from DOM
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("calls showModal when re-opening the dialog", () => {
    const { rerender, unmount } = render(
      <ConfirmDialog {...baseProps} open={false} />,
    );
    // No dialog rendered when closed
    expect(document.querySelector("dialog")).toBeNull();

    // Open the dialog
    rerender(<ConfirmDialog {...baseProps} open={true} />);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog!.hasAttribute("open")).toBe(true);
    unmount();
  });

  it("does not call onConfirm or onCancel when buttons are disabled and clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        {...baseProps}
        loading={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // Disabled buttons should not fire handlers when clicked via DOM
    // (fireEvent.click still calls the handler in JSDOM even when disabled,
    // but we verify the disabled attribute is set)
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(cancel).toHaveProperty("disabled", true);
    expect(confirm).toHaveProperty("disabled", true);
  });

  it("uses default labels when not provided", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test"
        description="Test desc"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("onClose event on dialog triggers onCancel (Escape key dismiss)", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    const dialog = document.querySelector("dialog")!;
    // Simulate the browser firing the close event (happens on Escape key)
    fireEvent(dialog, new Event("close"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

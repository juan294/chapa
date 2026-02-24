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
});

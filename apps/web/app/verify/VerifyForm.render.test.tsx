// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { VerifyForm } from "./VerifyForm";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

afterEach(() => {
  cleanup();
  mockPush.mockClear();
});

describe("VerifyForm", () => {
  // ─── Basic rendering ──────────────────────────────────────────────────

  it("renders label 'Verification Hash' and input with placeholder", () => {
    render(<VerifyForm />);
    expect(screen.getByLabelText("Verification Hash")).toBeDefined();
    expect(
      screen.getByPlaceholderText("a1b2c3d4e5f6a7b8"),
    ).toBeDefined();
  });

  it("renders a submit button with text 'Verify'", () => {
    render(<VerifyForm />);
    expect(screen.getByRole("button", { name: /verify/i })).toBeDefined();
  });

  // ─── Valid submission ─────────────────────────────────────────────────

  it("navigates to /verify/{hash} on valid 8-char hex submission", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "a1b2c3d4" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(mockPush).toHaveBeenCalledWith("/verify/a1b2c3d4");
  });

  it("navigates to /verify/{hash} on valid 16-char hex submission", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "a1b2c3d4e5f6a7b8" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(mockPush).toHaveBeenCalledWith("/verify/a1b2c3d4e5f6a7b8");
  });

  // ─── Invalid input ────────────────────────────────────────────────────

  it("shows error alert for input shorter than 8 chars", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a valid 8 or 16 character hex hash",
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error alert for non-hex characters", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "zzzzzzzz" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows error alert for 12-char hex (neither 8 nor 16)", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "a1b2c3d4e5f6" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ─── Error clearing ──────────────────────────────────────────────────

  it("clears error when input changes", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");

    // Trigger an error first
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(screen.getByRole("alert")).toBeDefined();

    // Change input — error should disappear
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // ─── Trim and lowercase ──────────────────────────────────────────────

  it("trims whitespace before validation and navigation", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "  a1b2c3d4  " } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(mockPush).toHaveBeenCalledWith("/verify/a1b2c3d4");
  });

  it("lowercases input before validation and navigation", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, { target: { value: "A1B2C3D4" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(mockPush).toHaveBeenCalledWith("/verify/a1b2c3d4");
  });

  it("trims and lowercases combined", () => {
    render(<VerifyForm />);
    const input = screen.getByLabelText("Verification Hash");
    fireEvent.change(input, {
      target: { value: "  A1B2C3D4E5F6A7B8  " },
    });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }));
    expect(mockPush).toHaveBeenCalledWith("/verify/a1b2c3d4e5f6a7b8");
  });
});

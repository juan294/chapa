// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ErrorBanner } from "./ErrorBanner";

afterEach(cleanup);

describe("ErrorBanner render", () => {
  it("renders the error message", () => {
    render(<ErrorBanner message="Something failed" />);
    expect(screen.getByText("Something failed")).toBeDefined();
  });

  it("renders with role=alert", () => {
    render(<ErrorBanner message="Test error" />);
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("dismisses when button is clicked", () => {
    render(<ErrorBanner message="Test error" />);
    const button = screen.getByLabelText("Dismiss error");
    fireEvent.click(button);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

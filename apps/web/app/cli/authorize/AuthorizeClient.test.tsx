// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AuthorizeClient } from "./AuthorizeClient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AuthorizeClient", () => {
  const defaultProps = {
    sessionId: "test-session-123",
    handle: "juandev",
  };

  it("renders the heading", () => {
    render(<AuthorizeClient {...defaultProps} />);
    expect(screen.getByText("Authorize Chapa CLI")).toBeDefined();
  });

  it("displays the user handle", () => {
    render(<AuthorizeClient {...defaultProps} />);
    expect(screen.getByText("juandev")).toBeDefined();
  });

  it("renders the Authorize CLI button", () => {
    render(<AuthorizeClient {...defaultProps} />);
    expect(screen.getByText("Authorize CLI")).toBeDefined();
  });

  it("shows Authorizing state while request is in flight", async () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(<AuthorizeClient {...defaultProps} />);
    fireEvent.click(screen.getByText("Authorize CLI"));
    expect(screen.getByText("Authorizing...")).toBeDefined();
  });

  it("shows success message after approval", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    render(<AuthorizeClient {...defaultProps} />);
    fireEvent.click(screen.getByText("Authorize CLI"));
    await waitFor(() => {
      expect(screen.getByText(/authorized/i)).toBeDefined();
    });
  });

  it("sends POST to /api/cli/auth/approve with sessionId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    render(<AuthorizeClient {...defaultProps} />);
    fireEvent.click(screen.getByText("Authorize CLI"));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/cli/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: "test-session-123" }),
      });
    });
  });

  it("shows error message on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    render(<AuthorizeClient {...defaultProps} />);
    fireEvent.click(screen.getByText("Authorize CLI"));
    await waitFor(() => {
      expect(screen.getByText(/failed to authorize/i)).toBeDefined();
    });
  });

  it("shows error message on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    render(<AuthorizeClient {...defaultProps} />);
    fireEvent.click(screen.getByText("Authorize CLI"));
    await waitFor(() => {
      expect(screen.getByText(/failed to authorize/i)).toBeDefined();
    });
  });
});

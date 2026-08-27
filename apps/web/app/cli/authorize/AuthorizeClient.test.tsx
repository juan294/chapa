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

// ---------------------------------------------------------------------------
// SE-H1 interim mitigation (#1174): surface the initiating device context
// (IP + user-agent captured at poll-time) so a user approving a request they
// did not themselves initiate has a visible signal.
// ---------------------------------------------------------------------------

describe("AuthorizeClient — device context (#1174)", () => {
  const defaultProps = {
    sessionId: "test-session-123",
    handle: "juandev",
  };

  it("renders the IP and user-agent when device context is provided", () => {
    render(
      <AuthorizeClient
        {...defaultProps}
        deviceContext={{ ip: "203.0.113.5", userAgent: "curl/8.0" }}
      />,
    );

    const box = screen.getByTestId("cli-device-context");
    expect(box.textContent).toContain("203.0.113.5");
    expect(box.textContent).toContain("curl/8.0");
  });

  it("shows an unavailable message when device context is null", () => {
    render(<AuthorizeClient {...defaultProps} deviceContext={null} />);

    const box = screen.getByTestId("cli-device-context");
    expect(box.textContent).not.toContain("undefined");
    // No IP/UA fields rendered — falls back to the unavailable copy key.
    expect(screen.queryByText("203.0.113.5")).toBeNull();
  });

  it("shows an unavailable message when device context prop is omitted entirely", () => {
    render(<AuthorizeClient {...defaultProps} />);
    expect(screen.getByTestId("cli-device-context")).toBeDefined();
  });

  it("renders a hostile user-agent value as inert text, not markup (XSS guard)", () => {
    const hostileUa = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <AuthorizeClient
        {...defaultProps}
        deviceContext={{ ip: "1.2.3.4", userAgent: hostileUa }}
      />,
    );

    // React must render this as a text node, never parsed as an <img> element.
    expect(container.querySelector("img")).toBeNull();
    const box = screen.getByTestId("cli-device-context");
    expect(box.textContent).toContain(hostileUa);
  });

  it("does not show the device context box after approval", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    render(
      <AuthorizeClient
        {...defaultProps}
        deviceContext={{ ip: "1.2.3.4", userAgent: "ua" }}
      />,
    );
    fireEvent.click(screen.getByText("Authorize CLI"));
    await waitFor(() => {
      expect(screen.getByText(/authorized/i)).toBeDefined();
    });
    expect(screen.queryByTestId("cli-device-context")).toBeNull();
  });
});

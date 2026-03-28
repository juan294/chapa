// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { SharePageShortcuts } from "./SharePageShortcuts";

const mockRegister = vi.fn(() => vi.fn());

vi.mock("./KeyboardShortcutsListener", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: mockRegister,
  }),
}));

/** Mock session fetch — defaults to no login. */
function mockSessionAs(login: string | null) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (typeof url === "string" && url.includes("/api/auth/session")) {
      return new Response(JSON.stringify({ user: login ? { login } : null }));
    }
    // Default passthrough for other fetches (refresh, etc.)
    return new Response("ok");
  });
}

beforeEach(() => {
  mockSessionAs(null); // default: not logged in
});

afterEach(() => {
  cleanup();
  mockRegister.mockClear();
  vi.restoreAllMocks();
});

describe("SharePageShortcuts", () => {
  it("renders null (renderless component)", () => {
    const { container } = render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("registers page shortcuts on mount", () => {
    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
      />,
    );
    expect(mockRegister).toHaveBeenCalledWith("share", expect.any(Function));
  });

  it("handler handles copy-embed shortcut", () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("copy-embed");
    expect(mockWriteText).toHaveBeenCalledWith("![badge](url)");
  });

  it("handler handles download-svg shortcut", () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = origCreate("a");
        el.click = clickSpy;
        return el;
      }
      return origCreate(tag);
    });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("download-svg");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handler handles refresh-badge shortcut when owner", async () => {
    // Mock session returning matching handle + refresh returning ok
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (typeof url === "string" && url.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ user: { login: "testuser" } }));
      }
      return new Response("ok");
    });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
      />,
    );

    // Wait for session fetch to resolve and handler to be re-registered with isOwner=true
    await waitFor(() => {
      expect(mockRegister.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    // Get the latest handler (registered after isOwner became true)
    const lastCall = mockRegister.mock.calls[mockRegister.mock.calls.length - 1] as unknown[];
    const handler = lastCall[1] as (id: string) => void;
    handler("refresh-badge");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/refresh?handle=testuser",
      { method: "POST" },
    );
  });

  it("handler does not refresh when not owner", async () => {
    // Mock session returning a different handle (not the owner)
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ user: { login: "otheruser" } }));
      }
      return new Response("ok");
    });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
      />,
    );

    // Wait for the session fetch to complete (isOwner stays false since handles don't match,
    // so the handler is not re-registered — just wait for the fetch to have been called)
    await waitFor(() => {
      const sessionCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/api/auth/session"),
      );
      expect(sessionCalls.length).toBeGreaterThanOrEqual(1);
    });

    // Get the handler (only registered once since isOwner stayed false)
    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("refresh-badge");

    // Fetch should only have been called for the session, NOT for the refresh
    const refreshCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/api/refresh"),
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

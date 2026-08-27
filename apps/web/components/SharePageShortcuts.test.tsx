// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SharePageShortcuts } from "./SharePageShortcuts";
import type { SessionUser } from "@/hooks/useSession";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

interface UseSessionReturn {
  session: SessionUser | null;
  loading: boolean;
  invalidate: () => void;
}
const mockUseSession = vi.fn<() => UseSessionReturn>();

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

const mockRegister = vi.fn(() => vi.fn());

vi.mock("./KeyboardShortcutsListener", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: mockRegister,
  }),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mockSessionAs(login: string | null) {
  mockUseSession.mockReturnValue({
    session: login ? { login, name: null, avatar_url: "" } : null,
    loading: false,
    invalidate: vi.fn(),
  });
}

/** Extract the handler callback from the most recent registerPageShortcuts call. */
function getHandler(): (id: string) => void {
  const calls = mockRegister.mock.calls;
  const lastCall = calls[calls.length - 1] as unknown[];
  return lastCall[1] as (id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Setup / Teardown                                                    */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  mockSessionAs(null);
});

afterEach(() => {
  cleanup();
  mockRegister.mockClear();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("SharePageShortcuts", () => {
  describe("copy-embed shortcut", () => {
    it("calls clipboard.writeText with the embed markdown", () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](https://example.com/badge.svg)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("copy-embed");
      expect(mockWriteText).toHaveBeenCalledWith(
        "![badge](https://example.com/badge.svg)",
      );
    });

    it("does not throw when the clipboard write rejects", async () => {
      const clipboardError = new Error("Clipboard blocked");
      const mockWriteText = vi.fn().mockRejectedValue(clipboardError);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      // Should not throw even though clipboard rejects
      expect(() => handler("copy-embed")).not.toThrow();
      // Wait for the rejected promise to settle
      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      });
    });

    // #1165 (UX-M4) — this used to swallow the rejection with NO feedback
    // either way. A rejected clipboard write must now surface a visible
    // failure state instead of silently doing nothing.
    it("surfaces a visible failure state when the clipboard write rejects", async () => {
      const clipboardError = new Error("Clipboard blocked");
      const mockWriteText = vi.fn().mockRejectedValue(clipboardError);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("copy-embed");

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Failed");
    });
  });

  describe("download-svg shortcut", () => {
    it("creates an anchor element with correct href and download attribute", () => {
      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      let capturedAnchor: HTMLAnchorElement | null = null;

      vi.spyOn(document, "createElement").mockImplementation(
        (tag: string) => {
          if (tag === "a") {
            const el = origCreate("a") as HTMLAnchorElement;
            el.click = clickSpy;
            capturedAnchor = el;
            return el;
          }
          return origCreate(tag);
        },
      );

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("download-svg");

      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor!.href).toContain(
        `/u/${encodeURIComponent("testuser")}/badge.svg`,
      );
      expect(capturedAnchor!.download).toBe("testuser-chapa-badge.svg");
      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("encodes the handle in the SVG URL", () => {
      const clickSpy = vi.fn();
      const origCreate = document.createElement.bind(document);
      let capturedAnchor: HTMLAnchorElement | null = null;

      vi.spyOn(document, "createElement").mockImplementation(
        (tag: string) => {
          if (tag === "a") {
            const el = origCreate("a") as HTMLAnchorElement;
            el.click = clickSpy;
            capturedAnchor = el;
            return el;
          }
          return origCreate(tag);
        },
      );

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="user with spaces"
        />,
      );

      const handler = getHandler();
      handler("download-svg");

      expect(capturedAnchor!.href).toContain(
        `/u/${encodeURIComponent("user with spaces")}/badge.svg`,
      );
    });
  });

  describe("refresh-badge shortcut", () => {
    it("triggers POST fetch and reload when isOwner is true", async () => {
      mockSessionAs("testuser");
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("refresh-badge");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/refresh?handle=testuser",
        { method: "POST" },
      );

      // Wait for the .then() to fire which calls reload
      await vi.waitFor(() => {
        expect(reloadMock).toHaveBeenCalled();
      });
    });

    it("does nothing when isOwner is false (different user)", () => {
      mockSessionAs("otheruser");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("refresh-badge");

      const refreshCalls = fetchSpy.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("/api/refresh"),
      );
      expect(refreshCalls).toHaveLength(0);
    });

    it("does nothing when user is not logged in", () => {
      mockSessionAs(null);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      handler("refresh-badge");

      const refreshCalls = fetchSpy.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("/api/refresh"),
      );
      expect(refreshCalls).toHaveLength(0);
    });

    it("silently catches network errors on refresh", async () => {
      mockSessionAs("testuser");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Network error"),
      );

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      // Should not throw
      expect(() => handler("refresh-badge")).not.toThrow();

      await vi.waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });
    });

    // #1165 (FE-H2) — server-resolved isOwner prop is authoritative over the
    // client useSession() fallback when provided.
    it("refreshes when isOwner prop is true, even if session mismatches", () => {
      mockSessionAs("someone-else");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
          isOwner={true}
        />,
      );

      const handler = getHandler();
      handler("refresh-badge");

      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/refresh?handle=testuser",
        { method: "POST" },
      );
    });

    it("does not refresh when isOwner prop is false, even if session matches", () => {
      mockSessionAs("testuser");
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
          isOwner={false}
        />,
      );

      const handler = getHandler();
      handler("refresh-badge");

      const refreshCalls = fetchSpy.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("/api/refresh"),
      );
      expect(refreshCalls).toHaveLength(0);
    });
  });

  describe("unknown shortcut", () => {
    it("does nothing for an unrecognized shortcut ID", () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("ok"));

      render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      const handler = getHandler();
      expect(() => handler("unknown-shortcut")).not.toThrow();
      expect(mockWriteText).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("registration lifecycle", () => {
    it("calls the cleanup function returned by registerPageShortcuts on unmount", () => {
      const cleanupFn = vi.fn();
      mockRegister.mockReturnValue(cleanupFn);

      const { unmount } = render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );

      unmount();
      expect(cleanupFn).toHaveBeenCalled();
    });

    it("renders nothing (returns null)", () => {
      const { container } = render(
        <SharePageShortcuts
          embedMarkdown="![badge](url)"
          handle="testuser"
        />,
      );
      expect(container.innerHTML).toBe("");
    });
  });
});

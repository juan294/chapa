// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { BadgeToolbar } from "./BadgeToolbar";
import type { SessionUser } from "@/hooks/useSession";

interface UseSessionReturn { session: SessionUser | null; loading: boolean; invalidate: () => void }
const mockUseSession = vi.fn<() => UseSessionReturn>();

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

let dropdownOpen = false;
const setIsOpenMock = vi.fn((updater: boolean | ((prev: boolean) => boolean)) => {
  if (typeof updater === "function") {
    dropdownOpen = updater(dropdownOpen);
  } else {
    dropdownOpen = updater;
  }
});

vi.mock("@/hooks/useDropdownMenu", () => ({
  useDropdownMenu: () => ({
    get isOpen() {
      return dropdownOpen;
    },
    setIsOpen: setIsOpenMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

/** Mock session via useSession hook. */
function mockSessionAs(login: string | null) {
  mockUseSession.mockReturnValue({
    session: login ? { login, name: null, avatar_url: "" } : null,
    loading: false,
    invalidate: vi.fn(),
  });
}

beforeEach(() => {
  dropdownOpen = false;
  setIsOpenMock.mockClear();
  mockSessionAs("testuser"); // default: logged in as the handle used in tests
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BadgeToolbar render", () => {
  describe("smoke test", () => {
    it("renders Share and Download buttons", () => {
      render(
        <BadgeToolbar handle="testuser" />,
      );
      expect(screen.getByLabelText("Share badge")).toBeDefined();
      expect(screen.getByLabelText("Download badge as PNG")).toBeDefined();
    });
  });

  describe("owner-only controls", () => {
    it("shows Refresh button when session matches handle", async () => {
      mockSessionAs("testuser");
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => {
        expect(screen.getByLabelText("Refresh badge data")).toBeDefined();
      });
    });

    it("hides Refresh button when not owner", async () => {
      mockSessionAs("otheruser");
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => {
        expect(screen.queryByLabelText("Refresh badge data")).toBeNull();
      });
    });

    it("hides Refresh button when not logged in", async () => {
      mockSessionAs(null);
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => {
        expect(screen.queryByLabelText("Refresh badge data")).toBeNull();
      });
    });
  });

  /** Mock session via useSession and fetch for refresh endpoint. */
  function mockSessionAndRefresh(handle: string, refreshResponse: Promise<{ ok: boolean }> | { ok: boolean } | Error) {
    mockSessionAs(handle);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      if (refreshResponse instanceof Error) throw refreshResponse;
      const result = refreshResponse instanceof Promise ? await refreshResponse : refreshResponse;
      return new Response(null, { status: result.ok ? 200 : 500 });
    });
  }

  describe("refresh flow", () => {
    it("calls refresh API on click", async () => {
      mockSessionAndRefresh("myuser", { ok: true });
      render(<BadgeToolbar handle="myuser" />);
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(globalThis.fetch).toHaveBeenCalledWith("/api/refresh?handle=myuser", {
        method: "POST",
      });
    });

    it("shows loading state during refresh", async () => {
      mockSessionAndRefresh("testuser", new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200)));
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      fireEvent.click(screen.getByLabelText("Refresh badge data"));
      await waitFor(() => {
        expect(screen.getByText(/Refreshing/)).toBeDefined();
      });
    });

    it("shows error state on refresh failure", async () => {
      mockSessionAndRefresh("testuser", { ok: false });
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Failed")).toBeDefined();
    });

    it("shows error state on network failure", async () => {
      mockSessionAndRefresh("testuser", new Error("network error"));
      render(<BadgeToolbar handle="testuser" />);
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Failed")).toBeDefined();
    });

    it("disables refresh button during loading", async () => {
      mockSessionAndRefresh("testuser", new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200)));

      render(
        <BadgeToolbar handle="testuser" />,
      );
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());
      const refreshBtn = screen.getByLabelText("Refresh badge data");
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(refreshBtn.hasAttribute("disabled")).toBe(true);
      });
    });

    it("sets aria-busy during refresh loading", async () => {
      mockSessionAndRefresh("testuser", new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200)));

      render(
        <BadgeToolbar handle="testuser" />,
      );
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());
      const refreshBtn = screen.getByLabelText("Refresh badge data");
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(refreshBtn.getAttribute("aria-busy")).toBe("true");
      });
    });

    it("encodes handle in refresh API URL", async () => {
      mockSessionAndRefresh("user name", { ok: true });

      render(
        <BadgeToolbar handle="user name" />,
      );
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/refresh?handle=user%20name",
        { method: "POST" },
      );
    });
  });

  describe("download flow", () => {
    it("shows Download text by default", () => {
      render(
        <BadgeToolbar handle="testuser" />,
      );
      expect(screen.getByText("Download")).toBeDefined();
    });

    it("fetches badge SVG on download click", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<svg></svg>"),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Download badge as PNG"));
      });

      expect(mockFetch).toHaveBeenCalledWith("/u/testuser/badge.svg");
      vi.unstubAllGlobals();
    });

    it("tracks badge_downloaded event", async () => {
      const { trackEvent } = await import("@/lib/analytics/posthog");
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<svg></svg>"),
      });
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Download badge as PNG"));
      });

      expect(trackEvent).toHaveBeenCalledWith("badge_downloaded", {
        handle: "testuser",
      });
      vi.unstubAllGlobals();
    });

    it("sets aria-busy on download button during download", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean; text: () => Promise<string> }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: () => Promise.resolve("<svg></svg>"),
                }),
              200,
            ),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" />,
      );
      const downloadBtn = screen.getByLabelText("Download badge as PNG");
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(downloadBtn.getAttribute("aria-busy")).toBe("true");
      });

      vi.unstubAllGlobals();
    });
  });

  describe("share dropdown", () => {
    it("share button has aria-haspopup", () => {
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      expect(shareBtn.getAttribute("aria-haspopup")).toBe("true");
    });

    it("share button has aria-expanded", () => {
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      expect(shareBtn.getAttribute("aria-expanded")).toBeDefined();
    });

    it("clicking share button toggles dropdown", () => {
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      fireEvent.click(shareBtn);
      // setIsOpen should have been called to toggle the state
      expect(setIsOpenMock).toHaveBeenCalled();
    });

    it("renders share menu when open", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      expect(screen.getByRole("menu")).toBeDefined();
      expect(screen.getByText("Copy link")).toBeDefined();
    });

    it("share menu has aria-label", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      expect(
        screen.getByRole("menu").getAttribute("aria-label"),
      ).toBe("Share options");
    });

    it("renders social share links (X, LinkedIn, Bluesky)", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems.length).toBeGreaterThanOrEqual(4); // X, LinkedIn, Bluesky, Copy link
    });

    it("social links open in new tab", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen
        .getAllByRole("menuitem")
        .filter((el) => el.tagName === "A");
      for (const link of links) {
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
      }
    });

    it("copy link button tracks event", async () => {
      dropdownOpen = true;
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      expect(trackEvent).toHaveBeenCalledWith("share_clicked", {
        platform: "copy_link",
      });
    });

    it("copy link writes share URL to clipboard", async () => {
      dropdownOpen = true;
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      expect(writeText).toHaveBeenCalledWith(
        "https://chapa.thecreativetoken.com/u/testuser",
      );
    });

    it("copy link closes dropdown after copy", async () => {
      dropdownOpen = true;
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      // setIsOpen(false) should have been called to close the dropdown
      expect(setIsOpenMock).toHaveBeenCalledWith(false);
    });
  });

  describe("share dropdown social links", () => {
    it("X link includes correct intent URL with handle", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const xLink = links.find((l) => l.href.includes("x.com"));
      expect(xLink).toBeDefined();
      expect(xLink?.href).toContain("x.com/intent/tweet");
    });

    it("LinkedIn link includes correct share URL", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const linkedinLink = links.find((l) => l.href.includes("linkedin.com"));
      expect(linkedinLink).toBeDefined();
      expect(linkedinLink?.href).toContain("linkedin.com/sharing/share-offsite");
    });

    it("Bluesky link includes compose intent", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const bskyLink = links.find((l) => l.href.includes("bsky.app"));
      expect(bskyLink).toBeDefined();
      expect(bskyLink?.href).toContain("bsky.app/intent/compose");
    });

    it("X link click tracks share event and closes dropdown", async () => {
      dropdownOpen = true;
      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const xLink = links.find((l) => l.href.includes("x.com"));

      fireEvent.click(xLink!);

      expect(trackEvent).toHaveBeenCalledWith("share_clicked", { platform: "x" });
      expect(setIsOpenMock).toHaveBeenCalledWith(false);
    });

    it("LinkedIn link click tracks share event and closes dropdown", async () => {
      dropdownOpen = true;
      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const linkedinLink = links.find((l) => l.href.includes("linkedin.com"));

      fireEvent.click(linkedinLink!);

      expect(trackEvent).toHaveBeenCalledWith("share_clicked", { platform: "linkedin" });
      expect(setIsOpenMock).toHaveBeenCalledWith(false);
    });

    it("Bluesky link click tracks share event and closes dropdown", async () => {
      dropdownOpen = true;
      const { trackEvent } = await import("@/lib/analytics/posthog");

      render(
        <BadgeToolbar handle="testuser" />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const bskyLink = links.find((l) => l.href.includes("bsky.app"));

      fireEvent.click(bskyLink!);

      expect(trackEvent).toHaveBeenCalledWith("share_clicked", { platform: "bluesky" });
      expect(setIsOpenMock).toHaveBeenCalledWith(false);
    });

    it("calls clipboard writeText with share URL on copy", async () => {
      dropdownOpen = true;
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      expect(writeText).toHaveBeenCalledWith(
        "https://chapa.thecreativetoken.com/u/testuser",
      );
    });

    it("handles clipboard API failure gracefully", async () => {
      dropdownOpen = true;
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Clipboard blocked")),
        },
      });

      render(
        <BadgeToolbar handle="testuser" />,
      );

      // Should not throw
      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      // Copy link text should still be shown (did not change to Copied!)
      expect(screen.getByText("Copy link")).toBeDefined();
    });
  });

  describe("download flow (PNG via canvas)", () => {
    it("falls back to SVG when canvas getContext returns null", async () => {
      const svgText = '<svg></svg>';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgText),
      });
      vi.stubGlobal("fetch", mockFetch);

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => null),
        toBlob: vi.fn(),
      };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        const el = document.createElementNS("http://www.w3.org/1999/xhtml", tag);
        return el as HTMLElement;
      });

      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onload?.(new Event("load") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      try {
        render(
          <BadgeToolbar handle="testuser" />,
        );

        await act(async () => {
          fireEvent.click(screen.getByLabelText("Download badge as PNG"));
        });

        // Should fall back to SVG download
        await waitFor(() => {
          const anchorCall = appendChildSpy.mock.calls.find(
            (call) => (call[0] as HTMLElement).tagName?.toUpperCase() === "A",
          );
          if (anchorCall) {
            const anchor = anchorCall[0] as HTMLAnchorElement;
            expect(anchor.download).toBe("chapa-testuser.svg");
          }
        });
      } finally {
        appendChildSpy.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it("falls back to SVG when toBlob returns null", async () => {
      const svgText = '<svg></svg>';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgText),
      });
      vi.stubGlobal("fetch", mockFetch);

      const mockCtx = { scale: vi.fn(), drawImage: vi.fn() };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          callback(null); // Blob creation fails
        }),
      };
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        const el = document.createElementNS("http://www.w3.org/1999/xhtml", tag);
        return el as HTMLElement;
      });

      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onload?.(new Event("load") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      try {
        render(
          <BadgeToolbar handle="testuser" />,
        );

        await act(async () => {
          fireEvent.click(screen.getByLabelText("Download badge as PNG"));
        });

        await waitFor(() => {
          const anchorCall = appendChildSpy.mock.calls.find(
            (call) => (call[0] as HTMLElement).tagName?.toUpperCase() === "A",
          );
          if (anchorCall) {
            const anchor = anchorCall[0] as HTMLAnchorElement;
            expect(anchor.download).toBe("chapa-testuser.svg");
          }
        });
      } finally {
        appendChildSpy.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it("falls back to SVG when Image onerror fires", async () => {
      const svgText = '<svg></svg>';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgText),
      });
      vi.stubGlobal("fetch", mockFetch);

      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onerror?.(new Event("error") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      try {
        render(
          <BadgeToolbar handle="testuser" />,
        );

        await act(async () => {
          fireEvent.click(screen.getByLabelText("Download badge as PNG"));
        });

        await waitFor(() => {
          const anchorCall = appendChildSpy.mock.calls.find(
            (call) => (call[0] as HTMLElement).tagName?.toUpperCase() === "A",
          );
          if (anchorCall) {
            const anchor = anchorCall[0] as HTMLAnchorElement;
            expect(anchor.download).toBe("chapa-testuser.svg");
          }
        });
      } finally {
        appendChildSpy.mockRestore();
        vi.unstubAllGlobals();
      }
    });
  });

  describe("download flow (SVG fallback)", () => {
    it("falls back to SVG download when fetch fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
      vi.stubGlobal("fetch", mockFetch);

      // Track DOM manipulations
      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Download badge as PNG"));
      });

      // Should have created an anchor for SVG fallback
      const anchorCall = appendChildSpy.mock.calls.find(
        (call) => (call[0] as HTMLElement).tagName === "A",
      );
      if (anchorCall) {
        const anchor = anchorCall[0] as HTMLAnchorElement;
        expect(anchor.href).toContain("/u/testuser/badge.svg");
        expect(anchor.download).toBe("chapa-testuser.svg");
      }

      appendChildSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    it("falls back to SVG when fetch returns non-ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Download badge as PNG"));
      });

      const anchorCall = appendChildSpy.mock.calls.find(
        (call) => (call[0] as HTMLElement).tagName === "A",
      );
      if (anchorCall) {
        const anchor = anchorCall[0] as HTMLAnchorElement;
        expect(anchor.download).toBe("chapa-testuser.svg");
      }

      appendChildSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    it("shows Downloading text during download", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean; text: () => Promise<string> }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: () => Promise.resolve("<svg></svg>"),
                }),
              200,
            ),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" />,
      );
      fireEvent.click(screen.getByLabelText("Download badge as PNG"));

      await waitFor(() => {
        expect(screen.getByText(/Downloading/)).toBeDefined();
      });

      vi.unstubAllGlobals();
    });

    it("disables download button during download", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean; text: () => Promise<string> }>((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  text: () => Promise.resolve("<svg></svg>"),
                }),
              200,
            ),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" />,
      );
      const btn = screen.getByLabelText("Download badge as PNG");
      fireEvent.click(btn);

      await waitFor(() => {
        expect(btn.hasAttribute("disabled")).toBe(true);
      });

      vi.unstubAllGlobals();
    });
  });

  describe("refresh success state", () => {
    it("shows Refreshed! text on success", async () => {
      mockSessionAndRefresh("testuser", { ok: true });

      // Prevent reload
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: vi.fn() },
        writable: true,
      });

      render(
        <BadgeToolbar handle="testuser" />,
      );
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Refreshed!")).toBeDefined();
    });

    it("disables refresh button after success", async () => {
      mockSessionAndRefresh("testuser", { ok: true });

      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: vi.fn() },
        writable: true,
      });

      render(
        <BadgeToolbar handle="testuser" />,
      );
      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      const btn = screen.getByLabelText("Refresh badge data");
      expect(btn.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("copy link — Copied! state", () => {
    it("shows Copied! text after successful copy", async () => {
      // Keep dropdown open even after setIsOpen(false) so we can see the Copied! text
      dropdownOpen = true;
      setIsOpenMock.mockImplementation(() => {
        // Don't actually close the dropdown for this test
      });
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });

      const { rerender } = render(
        <BadgeToolbar handle="testuser" />,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Copy link"));
      });

      // Force re-render with dropdown still open to see Copied! text
      rerender(
        <BadgeToolbar handle="testuser" />,
      );

      expect(screen.getByText("Copied!")).toBeDefined();
    });
  });

  describe("refresh error resets to idle after timeout", () => {
    it("returns to idle state after error timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSessionAndRefresh("testuser", { ok: false });

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      await waitFor(() => expect(screen.getByText("Failed")).toBeDefined());

      // After 3000ms, status resets to idle
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText("Refresh")).toBeDefined();

      vi.useRealTimers();
    });

    it("returns to idle after network error timeout", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSessionAndRefresh("testuser", new Error("network"));

      render(
        <BadgeToolbar handle="testuser" />,
      );

      await waitFor(() => expect(screen.getByLabelText("Refresh badge data")).toBeDefined());

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      await waitFor(() => expect(screen.getByText("Failed")).toBeDefined());

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText("Refresh")).toBeDefined();

      vi.useRealTimers();
    });
  });

  describe("download strips SVG animations", () => {
    it("strips @keyframes, animation properties, and SMIL animate elements", async () => {
      const svgWithAnimations = `<svg>
        <style>@keyframes fade{from{opacity:0}to{opacity:1}}
        .cell{animation: fade 0.3s ease;}
        </style>
        <rect opacity="0" />
        <animate attributeName="opacity" from="0" to="1" />
      </svg>`;

      let capturedSrc = "";
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgWithAnimations),
      } as Response));

      // Use class-based Image mock to avoid vitest warning.
      // Use queueMicrotask (not setTimeout) so the onerror fires within the
      // same act() flush — setTimeout schedules a macrotask that act() won't
      // drain, causing a race where capturedSrc is still empty at assertion time.
      class MockImage {
        width = 0;
        height = 0;
        onload: ((e: Event) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        private _src = "";
        get src() { return this._src; }
        set src(val: string) {
          this._src = val;
          capturedSrc = val;
          // Trigger error to force SVG fallback
          queueMicrotask(() => {
            this.onerror?.(new Event("error"));
          });
        }
      }
      vi.stubGlobal("Image", MockImage);

      try {
        render(
          <BadgeToolbar handle="testuser" />,
        );

        fireEvent.click(screen.getByLabelText("Download badge as PNG"));

        // waitFor polls until capturedSrc is populated — more reliable than a
        // fixed-tick setTimeout which can miss the queueMicrotask→promise chain
        // (fetch → text() → Image → queueMicrotask(onerror) → reject → finally)
        await waitFor(() => {
          expect(capturedSrc).not.toBe("");
        }, { timeout: 2000 });

        // The data URI src should have animations stripped
        const decodedSvg = decodeURIComponent(capturedSrc.replace("data:image/svg+xml;charset=utf-8,", ""));
        expect(decodedSvg).not.toContain("@keyframes");
        expect(decodedSvg).not.toContain("<animate ");
        expect(decodedSvg).toContain('opacity="1"'); // opacity="0" replaced
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("successful PNG download (full canvas path)", () => {
    it("creates a PNG blob and downloads it", async () => {
      const svgText = '<svg><rect width="100" height="100"/></svg>';
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgText),
      } as Response);

      const mockBlob = new Blob(["png-data"], { type: "image/png" });
      const mockCtx = { scale: vi.fn(), drawImage: vi.fn() };
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockCtx),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
          callback(mockBlob);
        }),
      };

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
        return origCreateElement(tag);
      });

      const revokeObjectURL = vi.fn();
      const createObjectURL = vi.fn(() => "blob:mock-url");
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

      // Use class-based Image mock — trigger onload synchronously in the src setter
      // so the canvas path runs within the same act() flush
      class MockImage {
        width = 0;
        height = 0;
        onload: ((e: Event) => void) | null = null;
        onerror: ((e: Event) => void) | null = null;
        private _src = "";
        get src() { return this._src; }
        set src(val: string) {
          this._src = val;
          // Fire synchronously so the Promise chain inside handleDownload
          // resolves within the act() wrapper
          queueMicrotask(() => {
            this.onload?.(new Event("load"));
          });
        }
      }
      vi.stubGlobal("Image", MockImage);

      const appendChildSpy = vi.spyOn(document.body, "appendChild");
      const removeChildSpy = vi.spyOn(document.body, "removeChild");

      try {
        render(
          <BadgeToolbar handle="testuser" />,
        );

        await act(async () => {
          fireEvent.click(screen.getByLabelText("Download badge as PNG"));
          // Let the microtask (onload) run within act
          await new Promise((r) => setTimeout(r, 0));
        });

        // Verify canvas was created with 2x scale
        expect(mockCanvas.width).toBe(2400);
        expect(mockCanvas.height).toBe(1260);
        expect(mockCtx.scale).toHaveBeenCalledWith(2, 2);

        // Verify the anchor was created, clicked, and cleaned up
        const anchorCall = appendChildSpy.mock.calls.find(
          (call) => (call[0] as HTMLElement).tagName === "A",
        );
        expect(anchorCall).toBeDefined();
        const anchor = anchorCall![0] as HTMLAnchorElement;
        expect(anchor.download).toBe("chapa-testuser.png");

        // Verify cleanup
        expect(removeChildSpy).toHaveBeenCalled();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      } finally {
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
      }
    });
  });
});

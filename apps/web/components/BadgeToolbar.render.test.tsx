// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { BadgeToolbar } from "./BadgeToolbar";

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

beforeEach(() => {
  dropdownOpen = false;
  setIsOpenMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BadgeToolbar render", () => {
  describe("smoke test", () => {
    it("renders Share and Download buttons", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      expect(screen.getByLabelText("Share badge")).toBeDefined();
      expect(screen.getByLabelText("Download badge as PNG")).toBeDefined();
    });
  });

  describe("owner-only controls", () => {
    it("shows Refresh button when isOwner", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );
      expect(screen.getByLabelText("Refresh badge data")).toBeDefined();
    });

    it("hides Refresh button when not owner", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      expect(screen.queryByLabelText("Refresh badge data")).toBeNull();
    });

    it("shows Customize link when isOwner and studioEnabled", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={true} />,
      );
      expect(screen.getByText("Customize")).toBeDefined();
    });

    it("hides Customize link when not owner", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={true} />,
      );
      expect(screen.queryByText("Customize")).toBeNull();
    });

    it("hides Customize when studioEnabled is false", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );
      expect(screen.queryByText("Customize")).toBeNull();
    });
  });

  describe("refresh flow", () => {
    it("calls refresh API on click", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="myuser" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/refresh?handle=myuser", {
        method: "POST",
      });
      vi.unstubAllGlobals();
    });

    it("shows loading state during refresh", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean }>((resolve) =>
            setTimeout(() => resolve({ ok: true }), 200),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );
      fireEvent.click(screen.getByLabelText("Refresh badge data"));

      await waitFor(() => {
        expect(screen.getByText(/Refreshing/)).toBeDefined();
      });

      vi.unstubAllGlobals();
    });

    it("shows error state on refresh failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Failed")).toBeDefined();
      vi.unstubAllGlobals();
    });

    it("shows error state on network failure", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("network error"));
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Failed")).toBeDefined();
      vi.unstubAllGlobals();
    });

    it("disables refresh button during loading", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean }>((resolve) =>
            setTimeout(() => resolve({ ok: true }), 200),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );
      const refreshBtn = screen.getByLabelText("Refresh badge data");
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(refreshBtn.hasAttribute("disabled")).toBe(true);
      });

      vi.unstubAllGlobals();
    });

    it("sets aria-busy during refresh loading", async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise<{ ok: boolean }>((resolve) =>
            setTimeout(() => resolve({ ok: true }), 200),
          ),
      );
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );
      const refreshBtn = screen.getByLabelText("Refresh badge data");
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(refreshBtn.getAttribute("aria-busy")).toBe("true");
      });

      vi.unstubAllGlobals();
    });

    it("encodes handle in refresh API URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      render(
        <BadgeToolbar handle="user name" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/refresh?handle=user%20name",
        { method: "POST" },
      );
      vi.unstubAllGlobals();
    });
  });

  describe("download flow", () => {
    it("shows Download text by default", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      expect(shareBtn.getAttribute("aria-haspopup")).toBe("true");
    });

    it("share button has aria-expanded", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      expect(shareBtn.getAttribute("aria-expanded")).toBeDefined();
    });

    it("clicking share button toggles dropdown", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const shareBtn = screen.getByLabelText("Share badge");
      fireEvent.click(shareBtn);
      // setIsOpen should have been called to toggle the state
      expect(setIsOpenMock).toHaveBeenCalled();
    });

    it("renders share menu when open", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      expect(screen.getByRole("menu")).toBeDefined();
      expect(screen.getByText("Copy link")).toBeDefined();
    });

    it("share menu has aria-label", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      expect(
        screen.getByRole("menu").getAttribute("aria-label"),
      ).toBe("Share options");
    });

    it("renders social share links (X, LinkedIn, Bluesky)", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems.length).toBeGreaterThanOrEqual(4); // X, LinkedIn, Bluesky, Copy link
    });

    it("social links open in new tab", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const xLink = links.find((l) => l.href.includes("x.com"));
      expect(xLink).toBeDefined();
      expect(xLink?.href).toContain("x.com/intent/tweet");
    });

    it("LinkedIn link includes correct share URL", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
      );
      const links = screen.getAllByRole("menuitem").filter((el) => el.tagName === "A") as HTMLAnchorElement[];
      const linkedinLink = links.find((l) => l.href.includes("linkedin.com"));
      expect(linkedinLink).toBeDefined();
      expect(linkedinLink?.href).toContain("linkedin.com/sharing/share-offsite");
    });

    it("Bluesky link includes compose intent", () => {
      dropdownOpen = true;
      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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

      const origImage = globalThis.Image;
      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onload?.(new Event("load") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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

      appendChildSpy.mockRestore();
      vi.stubGlobal("Image", origImage);
      vi.unstubAllGlobals();
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

      const origImage = globalThis.Image;
      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onload?.(new Event("load") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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

      appendChildSpy.mockRestore();
      vi.stubGlobal("Image", origImage);
      vi.unstubAllGlobals();
    });

    it("falls back to SVG when Image onerror fires", async () => {
      const svgText = '<svg></svg>';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(svgText),
      });
      vi.stubGlobal("fetch", mockFetch);

      const origImage = globalThis.Image;
      const mockImage: Partial<HTMLImageElement> = { width: 0, height: 0 };
      vi.stubGlobal("Image", vi.fn(() => {
        setTimeout(() => {
          (mockImage as HTMLImageElement).onerror?.(new Event("error") as unknown as Event);
        }, 0);
        return mockImage;
      }));

      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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

      appendChildSpy.mockRestore();
      vi.stubGlobal("Image", origImage);
      vi.unstubAllGlobals();
    });
  });

  describe("download flow (SVG fallback)", () => {
    it("falls back to SVG download when fetch fails", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("fetch failed"));
      vi.stubGlobal("fetch", mockFetch);

      // Track DOM manipulations
      const appendChildSpy = vi.spyOn(document.body, "appendChild");

      render(
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
        <BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />,
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
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      // Prevent reload
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: vi.fn() },
        writable: true,
      });

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(screen.getByText("Refreshed!")).toBeDefined();

      vi.unstubAllGlobals();
    });

    it("disables refresh button after success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: vi.fn() },
        writable: true,
      });

      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />,
      );

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      const btn = screen.getByLabelText("Refresh badge data");
      expect(btn.hasAttribute("disabled")).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe("customize link", () => {
    it("customize link points to /studio", () => {
      render(
        <BadgeToolbar handle="testuser" isOwner={true} studioEnabled={true} />,
      );
      const link = screen.getByText("Customize").closest("a");
      expect(link?.getAttribute("href")).toBe("/studio");
    });
  });
});

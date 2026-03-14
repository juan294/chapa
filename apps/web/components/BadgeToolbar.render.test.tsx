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

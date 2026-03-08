// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { BadgeToolbar } from "./BadgeToolbar";

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/hooks/useDropdownMenu", () => ({
  useDropdownMenu: vi.fn(() => ({
    isOpen: false,
    setIsOpen: vi.fn(),
  })),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    <a href={href} className={className}>{children}</a>,
}));

afterEach(cleanup);

describe("BadgeToolbar", () => {
  it("renders Share and Download buttons", () => {
    render(<BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />);
    expect(screen.getByLabelText("Share badge")).toBeDefined();
    expect(screen.getByLabelText("Download badge as PNG")).toBeDefined();
  });

  it("shows Refresh button when isOwner", () => {
    render(<BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />);
    expect(screen.getByLabelText("Refresh badge data")).toBeDefined();
  });

  it("hides Refresh button when not owner", () => {
    render(<BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />);
    expect(screen.queryByLabelText("Refresh badge data")).toBeNull();
  });

  it("shows Customize link when isOwner and studioEnabled", () => {
    render(<BadgeToolbar handle="testuser" isOwner={true} studioEnabled={true} />);
    expect(screen.getByText("Customize")).toBeDefined();
  });

  it("hides Customize link when not owner", () => {
    render(<BadgeToolbar handle="testuser" isOwner={false} studioEnabled={true} />);
    expect(screen.queryByText("Customize")).toBeNull();
  });

  it("hides Customize when studioEnabled is false", () => {
    render(<BadgeToolbar handle="testuser" isOwner={true} studioEnabled={false} />);
    expect(screen.queryByText("Customize")).toBeNull();
  });

  it("Download button text says Download by default", () => {
    render(<BadgeToolbar handle="testuser" isOwner={false} studioEnabled={false} />);
    expect(screen.getByText("Download")).toBeDefined();
  });

  describe("refresh flow", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("calls refresh API on click", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      render(<BadgeToolbar handle="myuser" isOwner={true} studioEnabled={false} />);

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Refresh badge data"));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/refresh?handle=myuser",
        { method: "POST" },
      );
    });
  });
});

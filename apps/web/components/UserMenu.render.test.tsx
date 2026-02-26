// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UserMenu } from "./UserMenu";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, onError, ...props }: { src: string; alt: string; onError?: () => void; width: number; height: number; className?: string }) =>
    <img src={src} alt={alt} data-testid="avatar" onError={onError} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabledSync: () => false,
  isBitbucketEnabledSync: () => false,
  isCodebergEnabledSync: () => false,
}));

vi.mock("@/hooks/useDropdownMenu", () => {
  let isOpen = false;
  return {
    useDropdownMenu: () => ({
      isOpen,
      setIsOpen: vi.fn((updater: boolean | ((prev: boolean) => boolean)) => {
        if (typeof updater === "function") {
          isOpen = updater(isOpen);
        } else {
          isOpen = updater;
        }
      }),
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps = {
  login: "testuser",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.png",
  isAdmin: false,
};

describe("UserMenu", () => {
  it("renders the trigger button with login", () => {
    render(<UserMenu {...baseProps} />);
    expect(screen.getByLabelText("User menu")).toBeDefined();
    expect(screen.getByText("testuser")).toBeDefined();
  });

  it("renders avatar image", () => {
    render(<UserMenu {...baseProps} />);
    const img = screen.getByAltText("testuser's avatar");
    expect(img).toBeDefined();
  });

  it("shows fallback letter when image errors", () => {
    render(<UserMenu {...baseProps} />);
    const img = screen.getByAltText("testuser's avatar");
    fireEvent.error(img);
    expect(screen.getByText("T")).toBeDefined();
  });

  it("renders chevron icon", () => {
    render(<UserMenu {...baseProps} />);
    const button = screen.getByLabelText("User menu");
    expect(button.querySelector("svg")).not.toBeNull();
  });
});

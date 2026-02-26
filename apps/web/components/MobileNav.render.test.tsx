// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MobileNav } from "./MobileNav";

afterEach(cleanup);

const LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Studio", href: "/studio" },
];

describe("MobileNav", () => {
  it("renders toggle button", () => {
    render(<MobileNav links={LINKS} />);
    expect(screen.getByLabelText("Toggle navigation")).toBeDefined();
  });

  it("menu is closed by default", () => {
    render(<MobileNav links={LINKS} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens menu on button click", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  it("renders all links when open", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByText(/home/i)).toBeDefined();
    expect(screen.getByText(/about/i)).toBeDefined();
    expect(screen.getByText(/studio/i)).toBeDefined();
  });

  it("closes menu when a link is clicked", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
    fireEvent.click(screen.getByText(/home/i));
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("closes menu on Escape key", () => {
    render(<MobileNav links={LINKS} />);
    fireEvent.click(screen.getByLabelText("Toggle navigation"));
    expect(screen.getByRole("navigation")).toBeDefined();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("aria-expanded reflects open state", () => {
    render(<MobileNav links={LINKS} />);
    const btn = screen.getByLabelText("Toggle navigation");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});

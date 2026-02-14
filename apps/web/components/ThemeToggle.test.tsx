// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import * as fs from "node:fs";
import * as path from "node:path";

afterEach(cleanup);

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockSetTheme.mockClear();
  });

  it("renders a button", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
  });

  it("has an aria-label indicating theme switch direction (light mode)", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Switch to dark theme");
  });

  it("has an aria-label indicating theme switch direction (dark mode)", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Switch to light theme");
  });

  it("calls setTheme with 'dark' when currently light", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with 'light' when currently dark", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("contains an SVG icon", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg).not.toBeNull();
  });

  it("SVG icon has aria-hidden=true (decorative)", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    const svg = button.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

const THEME_TOGGLE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "ThemeToggle.tsx"),
  "utf-8",
);

describe("ThemeToggle — mobile responsiveness (#240)", () => {
  it("button uses h-10 w-10 for 40px touch target", () => {
    expect(THEME_TOGGLE_SOURCE).toContain("h-10 w-10");
    // Ensure the old smaller size is not used
    expect(THEME_TOGGLE_SOURCE).not.toContain("h-8 w-8");
  });

  it("hydration placeholder also uses h-10 w-10", () => {
    // The placeholder div should match the button size to prevent layout shift
    const placeholderMatch = THEME_TOGGLE_SOURCE.match(
      /className="h-10 w-10"[\s\S]*?aria-hidden="true"/,
    );
    expect(placeholderMatch).not.toBeNull();
  });
});

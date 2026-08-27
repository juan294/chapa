// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

afterEach(cleanup);

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";
// resolvedTheme defaults to mockTheme unless a test overrides it explicitly —
// this lets most existing tests (which only set mockTheme) keep working
// unchanged while the system-preference tests below diverge the two.
let mockResolvedTheme: string | undefined;

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme ?? mockTheme,
  }),
}));

// Mock the shared useIsClient hook — controllable per-test so we can exercise
// both the hydrated render and the pre-hydration placeholder branch. If
// ThemeToggle stopped importing the hook from "@/hooks/useIsClient" (e.g. it
// reimplemented its own local hydration check instead), this mock would have
// no effect and the placeholder test below would fail to trigger.
const isClientState = vi.hoisted(() => ({ current: true }));
vi.mock("@/hooks/useIsClient", () => ({
  useIsClient: () => isClientState.current,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockResolvedTheme = undefined;
    mockSetTheme.mockClear();
    isClientState.current = true;
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

describe("ThemeToggle — icon transition (Phase 6)", () => {
  it("renders both theme icons wrapped for CSS cross-fade transition", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    const svgs = button.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    // Each icon's wrapping <span> drives the cross-fade.
    svgs.forEach((svg) => {
      const wrapper = svg.parentElement as HTMLElement;
      expect(wrapper.className).toContain("transition-[opacity,transform] duration-200");
    });
  });

  it("uses opacity and scale for icon cross-fade, flipped per theme", () => {
    mockTheme = "light";
    const { unmount } = render(<ThemeToggle />);
    let button = screen.getByRole("button");
    let [firstIcon, secondIcon] = Array.from(
      button.querySelectorAll("svg"),
    ).map((svg) => svg.parentElement as HTMLElement);
    // In light mode: the first (dark-mode) icon is hidden, the second
    // (light-mode) icon is shown.
    expect(firstIcon!.className).toContain("opacity-0 scale-75");
    expect(secondIcon!.className).toContain("opacity-100 scale-100");
    unmount();

    mockTheme = "dark";
    render(<ThemeToggle />);
    button = screen.getByRole("button");
    [firstIcon, secondIcon] = Array.from(button.querySelectorAll("svg")).map(
      (svg) => svg.parentElement as HTMLElement,
    );
    // In dark mode the two flip.
    expect(firstIcon!.className).toContain("opacity-100 scale-100");
    expect(secondIcon!.className).toContain("opacity-0 scale-75");
  });
});

describe("ThemeToggle — resolvedTheme under system preference (UX-M7, #1173)", () => {
  // ThemeProvider now enables next-themes' `enableSystem`, so `theme` can be
  // the literal string "system" rather than "light"/"dark". Deriving state
  // from `theme === "dark"` would then always read as light-mode (wrong icon,
  // wrong aria-label) for every system-preference user. The toggle must
  // derive its visual/aria state from `resolvedTheme`, which next-themes
  // always resolves to the concrete "light" or "dark".
  it("shows the dark-mode icon/label when theme is 'system' and the OS prefers dark (resolvedTheme='dark')", () => {
    mockTheme = "system";
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Switch to light theme");
  });

  it("shows the light-mode icon/label when theme is 'system' and the OS has no preference (resolvedTheme='light')", () => {
    mockTheme = "system";
    mockResolvedTheme = "light";
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("Switch to dark theme");
  });

  it("clicking while theme is 'system' toggles based on resolvedTheme, not the literal 'system' string", () => {
    mockTheme = "system";
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});

describe("ThemeToggle — mobile responsiveness (#240)", () => {
  it("button uses h-11 w-11 for 44px touch target (WCAG 2.5.8)", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-11 w-11");
    // Ensure the old smaller sizes are not used
    expect(button.className).not.toContain("h-8 w-8");
    expect(button.className).not.toContain("h-10 w-10");
  });

  it("hydration placeholder also uses h-11 w-11 to prevent layout shift", () => {
    isClientState.current = false;
    const { container } = render(<ThemeToggle />);
    // Pre-hydration: no button yet, just an invisible sized placeholder.
    expect(screen.queryByRole("button")).toBeNull();
    const placeholder = container.firstElementChild as HTMLElement;
    expect(placeholder.className).toContain("h-11 w-11");
    expect(placeholder.getAttribute("aria-hidden")).toBe("true");
  });
});

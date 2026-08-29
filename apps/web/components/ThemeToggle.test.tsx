// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

afterEach(cleanup);

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "light";
// resolvedTheme defaults to mockTheme unless a test overrides it explicitly.
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
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("SVG icons are aria-hidden (decorative)", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    for (const svg of Array.from(button.querySelectorAll("svg"))) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

// #1211 — the token layer moved theming onto `color-scheme`, which has three
// states: follow the OS, force light, force dark. The control is a single
// button that cycles system -> light -> dark -> system, and its aria-label
// names the mode the next press selects.
describe("ThemeToggle — three-mode cycle (#1211)", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockResolvedTheme = undefined;
    mockSetTheme.mockClear();
    isClientState.current = true;
  });

  it("advances system -> light", () => {
    mockTheme = "system";
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Switch to light theme",
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("advances light -> dark", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Switch to dark theme",
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("advances dark -> system", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Switch to system theme",
    );
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });

  it("treats an unknown or unset theme as system", () => {
    mockTheme = "";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("reports the active mode to assistive tech", () => {
    mockTheme = "system";
    mockResolvedTheme = "dark";
    render(<ThemeToggle />);
    // The button is a cycle, not an on/off switch, so it carries the current
    // mode as a data attribute rather than aria-pressed.
    expect(screen.getByRole("button").getAttribute("data-theme-mode")).toBe(
      "system",
    );
  });
});

describe("ThemeToggle — icon transition (Phase 6)", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockResolvedTheme = undefined;
    isClientState.current = true;
  });

  it("renders one icon per mode, wrapped for CSS cross-fade transition", () => {
    render(<ThemeToggle />);
    const svgs = screen.getByRole("button").querySelectorAll("svg");
    expect(svgs).toHaveLength(3);
    svgs.forEach((svg) => {
      const wrapper = svg.parentElement as HTMLElement;
      expect(wrapper.className).toContain(
        "transition-[opacity,transform] duration-200",
      );
    });
  });

  it("shows exactly the active mode's icon", () => {
    for (const [mode, index] of [
      ["system", 0],
      ["light", 1],
      ["dark", 2],
    ] as const) {
      mockTheme = mode;
      const { unmount } = render(<ThemeToggle />);
      const wrappers = Array.from(
        screen.getByRole("button").querySelectorAll("svg"),
      ).map((svg) => svg.parentElement as HTMLElement);
      wrappers.forEach((wrapper, i) => {
        expect(wrapper.className).toContain(
          i === index ? "opacity-100 scale-100" : "opacity-0 scale-75",
        );
      });
      unmount();
    }
  });
});

describe("ThemeToggle — mobile responsiveness (#240)", () => {
  beforeEach(() => {
    mockTheme = "light";
    isClientState.current = true;
  });

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

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import React, { forwardRef, useImperativeHandle } from "react";
import { GlobalCommandBar } from "./GlobalCommandBar";

const mockPush = vi.fn();
const mockSetTheme = vi.fn();
vi.mock("next-themes", () => ({useTheme: () => ({theme: "dark", setTheme: mockSetTheme})}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
}));

// Track the ref-clear calls
const mockClear = vi.fn();
const mockFill = vi.fn();

vi.mock("@/components/terminal/TerminalInput", () => ({
  TerminalInput: forwardRef(function MockTerminalInput(
    {
      onSubmit,
      onPartialChange,
      prompt,
      history,
    }: {
      onSubmit: (cmd: string) => void;
      onPartialChange?: (val: string) => void;
      prompt?: string;
      history?: string[];
    },
    ref: React.Ref<{ clear: () => void; focus: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({
      clear: mockClear,
      fill: mockFill,
      focus: vi.fn(),
    }));
    return (
      <div data-testid="terminal-input" data-history={JSON.stringify(history)}>
        <input
          id="terminal-command-input"
          data-testid="cmd-input"
          aria-label="Terminal command input"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onPartialChange?.(e.target.value)
          }
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              onSubmit((e.target as HTMLInputElement).value);
            }
          }}
        />
        <span>{prompt}</span>
      </div>
    );
  }),
}));

vi.mock("@/components/terminal/TerminalOutput", () => ({
  TerminalOutput: ({ lines }: { lines: Array<{ text: string }> }) => (
    <div data-testid="terminal-output">
      {lines.map((l: { text: string }, i: number) => (
        <span key={i}>{l.text}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/terminal/AutocompleteDropdown", () => ({
  AutocompleteDropdown: ({
    visible,
    onSelect,
    onFill,
  }: {
    visible: boolean;
    onSelect: (cmd: string) => void;
    onFill: (cmd: string) => void;
  }) =>
    visible ? (
      <div data-testid="autocomplete">
        <button data-testid="autocomplete-select" onClick={() => onSelect("/about")}>
          Select
        </button>
        <button data-testid="autocomplete-fill" onClick={() => onFill("/badge")}>
          Fill
        </button>
      </div>
    ) : null,
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  mockPush.mockClear();
  mockClear.mockClear();
  vi.useRealTimers();
});

describe("GlobalCommandBar", () => {
  it("renders terminal input", () => {
    render(<GlobalCommandBar />);
    expect(screen.getByTestId("terminal-input")).toBeDefined();
  });

  it("allows an editor to intercept command navigation", () => {
    const intercept = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener("chapa:app-navigation", intercept);
    try {
      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");
      fireEvent.change(input, { target: { value: "/about" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(intercept).toHaveBeenCalledOnce();
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("chapa:app-navigation", intercept);
    }
  });

  it("navigates on submit with navigation command", () => {
    render(<GlobalCommandBar />);
    const input = screen.getByTestId("cmd-input");
    fireEvent.change(input, { target: { value: "/about" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/about");
  });

  it("shows autocomplete when typing /", () => {
    render(<GlobalCommandBar />);
    const input = screen.getByTestId("cmd-input");
    fireEvent.change(input, { target: { value: "/" } });
    expect(screen.getByTestId("autocomplete")).toBeDefined();
  });

  it("hides autocomplete when input does not start with /", () => {
    render(<GlobalCommandBar />);
    const input = screen.getByTestId("cmd-input");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(screen.queryByTestId("autocomplete")).toBeNull();
  });

  describe("handleAutocompleteSelect (lines 90-101)", () => {
    it("navigates via autocomplete selection and clears input ref", () => {
      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");

      // Type "/" to open autocomplete
      fireEvent.change(input, { target: { value: "/" } });
      expect(screen.getByTestId("autocomplete")).toBeDefined();

      // Select /about from autocomplete
      fireEvent.click(screen.getByTestId("autocomplete-select"));

      // handleAutocompleteSelect calls handleSubmit("/about") -> router.push
      expect(mockPush).toHaveBeenCalledWith("/about");
      // And calls terminalRef.current.clear()
      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe("handleAutocompleteFill (lines 103-117)", () => {
    it("fills through the controlled input handle", () => {
      render(<GlobalCommandBar />);
      fireEvent.change(screen.getByTestId("cmd-input"), {target: {value: "/"}});
      fireEvent.click(screen.getByTestId("autocomplete-fill"));
      expect(mockFill).toHaveBeenCalledWith("/badge ");
    });
  });

  describe("custom event dispatch", () => {
    it("dispatches CustomEvent for custom action commands and clears output", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      render(<GlobalCommandBar isAdmin />);
      const input = screen.getByTestId("cmd-input");

      // /refresh is an admin custom command
      fireEvent.change(input, { target: { value: "/refresh" } });
      fireEvent.keyDown(input, { key: "Enter" });

      const customEvent = dispatchSpy.mock.calls.find(
        (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === "chapa:admin-refresh",
      );
      expect(customEvent).toBeDefined();

      dispatchSpy.mockRestore();
    });

    it("dispatches CustomEvent with detail for commands that have it", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      render(<GlobalCommandBar isAdmin />);
      const input = screen.getByTestId("cmd-input");

      // /sort score is an admin command with detail
      fireEvent.change(input, { target: { value: "/sort score" } });
      fireEvent.keyDown(input, { key: "Enter" });

      const customEvent = dispatchSpy.mock.calls.find(
        (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === "chapa:admin-sort",
      );
      expect(customEvent).toBeDefined();
      expect((customEvent![0] as CustomEvent).detail).toEqual({ field: "adjustedComposite" });

      dispatchSpy.mockRestore();
    });
  });

  describe("login navigation", () => {
    it("uses window.location.href for /api/auth/login path", () => {
      const originalHref = window.location.href;
      // Assigning window.location.href triggers jsdom's "Not implemented:
      // navigation" notice. Stub the location getter to return a plain object
      // whose href setter is a harmless no-op, so the component's navigation
      // is exercised without leaking jsdom noise into passing output (#817).
      const assign = vi.fn();
      const hrefSpy = vi.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        href: originalHref,
        assign,
      } as unknown as Location);

      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");
      fireEvent.change(input, { target: { value: "/login" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // /login should NOT use router.push
      expect(mockPush).not.toHaveBeenCalled();

      hrefSpy.mockRestore();
    });
  });

  describe("output auto-clear timeout", () => {
    it("keeps output readable until the next input", () => {
      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");

      // Submit /help to generate output lines
      fireEvent.change(input, { target: { value: "/help" } });
      fireEvent.keyDown(input, { key: "Enter" });

      // Output should be visible
      expect(screen.getByTestId("terminal-output")).toBeDefined();

      // Advance time past OUTPUT_TIMEOUT_MS (5000ms)
      act(() => {
        vi.advanceTimersByTime(5001);
      });

      // Help remains readable without a deadline.
      expect(screen.getByTestId("terminal-output")).toBeDefined();
    });

    it("clears output on next keystroke", () => {
      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");

      // Submit /help to generate output
      fireEvent.change(input, { target: { value: "/help" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByTestId("terminal-output")).toBeDefined();

      // Type something new — should clear output
      fireEvent.change(input, { target: { value: "a" } });

      expect(screen.queryByTestId("terminal-output")).toBeNull();
    });
  });

  // The chip row was removed: the landing page already carries the same
  // navigation above the fold, and the dock is for typing commands, not
  // clicking buttons. Typing `/` opens the autocomplete instead.
  describe("suggestion chips", () => {
    it("renders no chip row under the input", () => {
      render(<GlobalCommandBar />);
      expect(screen.queryByLabelText("Command suggestions")).toBeNull();
    });
  });
});


describe("theme and session history", () => {
  it("reads provider preference and only sets valid choices", () => {
    mockSetTheme.mockClear();
    render(<GlobalCommandBar />);
    const input = screen.getByTestId("cmd-input");
    const submit = (value: string) => {fireEvent.change(input, {target: {value}}); fireEvent.keyDown(input, {key: "Enter"});};
    submit("/theme");
    expect(screen.getByTestId("terminal-output").textContent).toContain("dark");
    expect(mockSetTheme).not.toHaveBeenCalled();
    submit("/theme purple");
    expect(mockSetTheme).not.toHaveBeenCalled();
    submit("/theme system");
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
  it("bounds history at 50 and preserves it when clearing", () => {
    render(<GlobalCommandBar />);
    const input = screen.getByTestId("cmd-input");
    for (let i = 0; i < 55; i++) {fireEvent.change(input, {target: {value: `/unknown${i}`}}); fireEvent.keyDown(input, {key: "Enter"});}
    fireEvent.change(input, {target: {value: "/clear"}}); fireEvent.keyDown(input, {key: "Enter"});
    const history = JSON.parse(screen.getByTestId("terminal-input").getAttribute("data-history")!);
    expect(history).toHaveLength(50);
    expect(history[0]).toBe("/unknown6");
    expect(history.at(-1)).toBe("/clear");
    expect(screen.queryByTestId("terminal-output")).toBeNull();
  });
});

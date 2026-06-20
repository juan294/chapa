// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import React, { forwardRef, useImperativeHandle } from "react";
import { GlobalCommandBar } from "./GlobalCommandBar";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/AuthorTypewriter", () => ({
  AuthorTypewriter: () => <div data-testid="author-typewriter" />,
}));

// Track the ref-clear calls
const mockClear = vi.fn();

vi.mock("@/components/terminal/TerminalInput", () => ({
  TerminalInput: forwardRef(function MockTerminalInput(
    {
      onSubmit,
      onPartialChange,
      prompt,
    }: {
      onSubmit: (cmd: string) => void;
      onPartialChange?: (val: string) => void;
      prompt?: string;
    },
    ref: React.Ref<{ clear: () => void; focus: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({
      clear: mockClear,
      focus: vi.fn(),
    }));
    return (
      <div data-testid="terminal-input">
        <input
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

  it("renders AuthorTypewriter", () => {
    render(<GlobalCommandBar />);
    expect(screen.getByTestId("author-typewriter")).toBeDefined();
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
    it("fills the input element with the command via native setter and focuses it", () => {
      render(<GlobalCommandBar />);
      const input = screen.getByTestId("cmd-input");

      // Type "/" to open autocomplete
      fireEvent.change(input, { target: { value: "/" } });
      expect(screen.getByTestId("autocomplete")).toBeDefined();

      // The mock input has aria-label="Terminal command input" which handleAutocompleteFill queries
      const nativeSetterSpy = vi.fn();
      const origDescriptor = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      );
      Object.defineProperty(window.HTMLInputElement.prototype, "value", {
        ...origDescriptor,
        set: nativeSetterSpy,
      });

      const focusSpy = vi.spyOn(input, "focus");

      // Click the fill button
      fireEvent.click(screen.getByTestId("autocomplete-fill"));

      // handleAutocompleteFill should have used nativeInputValueSetter to set value
      expect(nativeSetterSpy).toHaveBeenCalledWith("/badge ");
      expect(focusSpy).toHaveBeenCalled();

      // Restore
      Object.defineProperty(window.HTMLInputElement.prototype, "value", origDescriptor!);
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
    it("auto-clears output lines after OUTPUT_TIMEOUT_MS", () => {
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

      // Output should be cleared
      expect(screen.queryByTestId("terminal-output")).toBeNull();
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
});

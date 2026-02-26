// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { GlobalCommandBar } from "./GlobalCommandBar";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/AuthorTypewriter", () => ({
  AuthorTypewriter: () => <div data-testid="author-typewriter" />,
}));

vi.mock("@/components/terminal/TerminalInput", () => ({
  TerminalInput: function MockTerminalInput({
    onSubmit,
    onPartialChange,
    prompt,
  }: {
    onSubmit: (cmd: string) => void;
    onPartialChange?: (val: string) => void;
    prompt?: string;
  }) {
    return (
      <div data-testid="terminal-input">
        <input
          data-testid="cmd-input"
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
  },
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
  }: {
    visible: boolean;
    onSelect: (cmd: string) => void;
  }) =>
    visible ? (
      <div data-testid="autocomplete">
        <button onClick={() => onSelect("/about")}>Select</button>
      </div>
    ) : null,
}));

afterEach(() => {
  cleanup();
  mockPush.mockClear();
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
});

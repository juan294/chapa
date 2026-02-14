// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TerminalOutput } from "./TerminalOutput";
import type { OutputLine } from "./command-registry";

// jsdom doesn't implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(cleanup);

function makeLine(
  type: OutputLine["type"],
  text: string,
  id?: string,
): OutputLine {
  return { id: id ?? `test-${Math.random()}`, type, text };
}

describe("TerminalOutput", () => {
  it("renders with role=log for accessibility", () => {
    render(<TerminalOutput lines={[]} />);
    const log = screen.getByRole("log");
    expect(log).toBeDefined();
  });

  it("has aria-live=polite for screen readers", () => {
    render(<TerminalOutput lines={[]} />);
    const log = screen.getByRole("log");
    expect(log.getAttribute("aria-live")).toBe("polite");
  });

  it("has an accessible aria-label", () => {
    render(<TerminalOutput lines={[]} />);
    const log = screen.getByLabelText("Terminal output");
    expect(log).toBeDefined();
  });

  it("renders output lines with correct text", () => {
    const lines: OutputLine[] = [
      makeLine("info", "Hello world", "l1"),
      makeLine("success", "Done!", "l2"),
    ];
    render(<TerminalOutput lines={lines} />);
    expect(screen.getByText("Hello world")).toBeDefined();
    expect(screen.getByText("Done!")).toBeDefined();
  });

  it("renders empty output without errors", () => {
    const { container } = render(<TerminalOutput lines={[]} />);
    const log = container.querySelector('[role="log"]');
    expect(log).toBeDefined();
  });

  it("renders all line types without errors", () => {
    const types: OutputLine["type"][] = [
      "input",
      "success",
      "error",
      "warning",
      "system",
      "info",
      "dim",
    ];
    const lines = types.map((type, i) =>
      makeLine(type, `${type} line`, `line-${i}`),
    );
    render(<TerminalOutput lines={lines} />);
    for (const type of types) {
      expect(screen.getByText(`${type} line`)).toBeDefined();
    }
  });

  it("shows prefix characters for each line type", () => {
    const lines: OutputLine[] = [makeLine("input", "test command", "l1")];
    const { container } = render(<TerminalOutput lines={lines} />);
    // The input type gets a "> " prefix
    const prefixSpans = container.querySelectorAll(".text-terminal-dim");
    expect(prefixSpans.length).toBeGreaterThan(0);
  });
});

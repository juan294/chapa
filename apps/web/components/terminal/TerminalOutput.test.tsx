// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TerminalOutput } from "./TerminalOutput";
import type { OutputLine } from "./command-registry";
import { LanguageProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";

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

  it("localizes its accessible label", () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <TerminalOutput lines={[]} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("log", { name: "Salida de terminal" })).toBeDefined();
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

// ---------------------------------------------------------------------------
// Line-type color mapping tests (branch coverage for TYPE_STYLES)
// ---------------------------------------------------------------------------

describe("TerminalOutput — line type color classes", () => {
  const typeStyleMap: Array<[OutputLine["type"], string]> = [
    ["input", "text-amber"],
    ["success", "text-terminal-green"],
    ["error", "text-terminal-red"],
    ["warning", "text-terminal-yellow"],
    ["system", "text-text-secondary"],
    ["info", "text-text-primary"],
    ["dim", "text-terminal-dim"],
  ];

  it.each(typeStyleMap)(
    "applies %s style class: %s",
    (type, expectedClass) => {
      const lines: OutputLine[] = [makeLine(type, `${type} message`, `id-${type}`)];
      render(<TerminalOutput lines={lines} />);

      // Find the line div by its text content and check className
      const lineText = screen.getByText(`${type} message`);
      const lineDiv = lineText.closest("div");
      expect(lineDiv).not.toBeNull();
      expect(lineDiv!.className).toContain(expectedClass);

      cleanup();
    },
  );
});

// ---------------------------------------------------------------------------
// Line-type prefix mapping tests (branch coverage for TYPE_PREFIX)
// ---------------------------------------------------------------------------

describe("TerminalOutput — line type prefix characters", () => {
  const typePrefixMap: Array<[OutputLine["type"], string]> = [
    ["input", "> "],
    ["success", "  "],
    ["error", "! "],
    ["warning", "~ "],
    ["system", "$ "],
    ["info", "  "],
    ["dim", "  "],
  ];

  it.each(typePrefixMap)(
    "renders correct prefix for %s: '%s'",
    (type, expectedPrefix) => {
      const lines: OutputLine[] = [makeLine(type, `test-${type}`, `id-${type}`)];
      const { container } = render(<TerminalOutput lines={lines} />);

      // The prefix is in a .text-terminal-dim span
      const prefixSpan = container.querySelector(".text-terminal-dim.select-none");
      expect(prefixSpan).not.toBeNull();
      expect(prefixSpan!.textContent).toBe(expectedPrefix);

      cleanup();
    },
  );
});

// ---------------------------------------------------------------------------
// Fallback for unknown line types (default branch of ?? operators)
// ---------------------------------------------------------------------------

describe("TerminalOutput — unknown type fallback", () => {
  it("defaults to text-text-primary for an unknown line type", () => {
    // Force an unknown type to exercise the ?? fallback
    const lines: OutputLine[] = [
      { id: "unknown-1", type: "custom" as OutputLine["type"], text: "unknown line" },
    ];
    render(<TerminalOutput lines={lines} />);

    const lineText = screen.getByText("unknown line");
    const lineDiv = lineText.closest("div");
    expect(lineDiv).not.toBeNull();
    // Should use fallback class text-text-primary
    expect(lineDiv!.className).toContain("text-text-primary");
  });

  it("defaults to double-space prefix for an unknown line type", () => {
    const lines: OutputLine[] = [
      { id: "unknown-2", type: "other" as OutputLine["type"], text: "other line" },
    ];
    render(<TerminalOutput lines={lines} />);

    const lineText = screen.getByText("other line");
    const lineDiv = lineText.closest("div");
    expect(lineDiv).not.toBeNull();
    // The prefix span is the first child
    const prefixSpan = lineDiv!.querySelector("span");
    expect(prefixSpan).not.toBeNull();
    expect(prefixSpan!.textContent).toBe("  ");
  });
});

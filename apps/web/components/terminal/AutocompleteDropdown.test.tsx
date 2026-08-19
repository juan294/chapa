// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AutocompleteDropdown.tsx"),
  "utf-8",
);

// Mock command-registry at module level
vi.mock("./command-registry", () => ({
  getMatchingCommands: (partial: string, commands: { name: string; aliases?: string[] }[]) => {
    const lower = partial.toLowerCase();
    if (!lower.startsWith("/")) return [];
    return commands.filter(
      (c) =>
        c.name.startsWith(lower) ||
        (c.aliases && c.aliases.some((a: string) => a.startsWith(lower))),
    );
  },
}));

import { AutocompleteDropdown } from "./AutocompleteDropdown";
import type { CommandDef } from "./command-registry";

const noop = () => ({ lines: [], action: undefined });

const testCommands: CommandDef[] = [
  { name: "/help", description: "Show help", usage: "/help [topic]", execute: noop },
  { name: "/clear", description: "Clear terminal", execute: noop },
  { name: "/theme", description: "Set theme", usage: "/theme <name>", execute: noop },
  { name: "/history", description: "Show history", execute: noop },
];

afterEach(cleanup);

describe("AutocompleteDropdown", () => {
  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("terminal layout (runtime)", () => {
    it("uses compact padding on option items (py-1.5, not py-2.5)", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      expect(options[0]!.className).toContain("py-1.5");
      expect(options[0]!.className).not.toContain("py-2.5");
    });

    it("uses terminal font on the dropdown container", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const listbox = screen.getByRole("listbox");
      expect(listbox.className).toContain("font-terminal");
    });

    it("command name, description, and usage hint share the same font size (no text-xs override)", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/he"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      const spans = options[0]!.querySelectorAll("span");
      spans.forEach((span) => {
        expect(span.className).not.toContain("text-xs");
      });
    });

    it("uses a fixed-width column for the command name to align descriptions", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      const nameSpan = options[0]!.querySelector("span");
      expect(nameSpan!.className).toMatch(/min-w-|w-\[/);
    });
  });

  describe("argument hints (runtime)", () => {
    it("uses dim styling for the usage hint, distinct from the description", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/he"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      const spans = options[0]!.querySelectorAll("span");
      const usageSpan = spans[spans.length - 1]!;
      expect(usageSpan.textContent).toBe("[topic]");
      expect(usageSpan.className).toMatch(/text-text-secondary|text-terminal-dim/);
    });
  });

  describe("alias support via getMatchingCommands (issue #118)", () => {
    it("matches commands by alias, not just by name prefix", () => {
      const commandsWithAlias: CommandDef[] = [
        ...testCommands,
        { name: "/exit", aliases: ["/q"], description: "Quit terminal", execute: noop },
      ];
      render(
        <AutocompleteDropdown
          commands={commandsWithAlias}
          partial="/q"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // "/exit" does not start with "/q" — it only matches via its alias,
      // which is only possible through getMatchingCommands' alias-aware
      // filtering, not an inline c.name.startsWith check.
      expect(screen.getByText("/exit")).toBeDefined();
    });
  });

  describe("accessibility (runtime)", () => {
    it("renders options as non-interactive <div> elements, not <button> (#421)", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      options.forEach((option) => {
        expect(option.tagName).toBe("DIV");
      });
    });

    it("sets tabIndex={-1} on options for programmatic focus", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      options.forEach((option) => {
        expect(option.getAttribute("tabindex")).toBe("-1");
      });
    });
  });

  // ---- Runtime rendering tests ----

  describe("rendering", () => {
    it("returns null when visible is false", () => {
      const { container } = render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={false}
        />,
      );
      expect(container.innerHTML).toBe("");
    });

    it("returns null when no commands match", () => {
      const { container } = render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/zzz"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      expect(container.innerHTML).toBe("");
    });

    it("renders matching commands when visible", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // /help and /history match "/h"
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(2);
    });

    it("shows command name and description", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/cl"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      expect(screen.getByText("/clear")).toBeDefined();
      expect(screen.getByText("Clear terminal")).toBeDefined();
    });

    it("shows usage hint when command has usage (minus the command name prefix)", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/he"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // Usage is "/help [topic]", display strips "/help " prefix, leaving "[topic]"
      expect(screen.getByText("[topic]")).toBeDefined();
    });

    it("does not show usage hint when command has no usage", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/cl"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // /clear has no usage field
      const options = screen.getAllByRole("option");
      expect(options.length).toBe(1);
      // Only name and description spans
      const spans = options[0]!.querySelectorAll("span");
      expect(spans.length).toBe(2); // name + description, no usage
    });

    it("marks first item as active (aria-selected=true) by default", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      expect(options[0]!.getAttribute("aria-selected")).toBe("true");
      expect(options[1]!.getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("keyboard navigation (runtime)", () => {
    it("ArrowDown moves active index forward", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      expect(options[0]!.getAttribute("aria-selected")).toBe("true");

      // Dispatch ArrowDown on document (capture phase)
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });

      expect(options[1]!.getAttribute("aria-selected")).toBe("true");
      expect(options[0]!.getAttribute("aria-selected")).toBe("false");
    });

    it("ArrowDown wraps from last to first", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // Move to last item (index 1)
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      // Now wrap to first (index 0)
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      const options = screen.getAllByRole("option");
      expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    });

    it("ArrowUp wraps from first to last", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // Active is 0, pressing ArrowUp should wrap to last (index 1)
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
      });
      const options = screen.getAllByRole("option");
      expect(options[1]!.getAttribute("aria-selected")).toBe("true");
    });

    it("Enter selects the active command via onSelect", () => {
      const onSelect = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          visible={true}
        />,
      );
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });
      expect(onSelect).toHaveBeenCalledWith("/help");
    });

    it("Tab calls onFill when provided", () => {
      const onFill = vi.fn();
      const onSelect = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          onFill={onFill}
          visible={true}
        />,
      );
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
      });
      expect(onFill).toHaveBeenCalledWith("/help");
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Tab falls back to onSelect when onFill is not provided", () => {
      const onSelect = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          visible={true}
        />,
      );
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
        );
      });
      expect(onSelect).toHaveBeenCalledWith("/help");
    });

    it("Escape calls onDismiss", () => {
      const onDismiss = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          onDismiss={onDismiss}
          visible={true}
        />,
      );
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("intercepts arrow keys in the capture phase, stopping propagation to other document listeners", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const bubbleListener = vi.fn();
      window.addEventListener("keydown", bubbleListener);
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      window.removeEventListener("keydown", bubbleListener);

      // The dropdown's capture-phase handler stops propagation, so a
      // bubble-phase listener on window (simulating TerminalInput's own
      // history navigation) never sees the event.
      expect(bubbleListener).not.toHaveBeenCalled();
      const options = screen.getAllByRole("option");
      expect(options[1]!.getAttribute("aria-selected")).toBe("true");
    });

    it("removes the keydown listener on unmount", () => {
      const onSelect = vi.fn();
      const { unmount } = render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          visible={true}
        />,
      );
      unmount();
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("ignores keyboard events when not visible", () => {
      const onSelect = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          visible={false}
        />,
      );
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("mouse interaction (runtime)", () => {
    it("click on an option calls onSelect with command name", () => {
      const onSelect = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={onSelect}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      fireEvent.click(options[1]!);
      expect(onSelect).toHaveBeenCalledWith("/history");
    });

    it("mouseEnter on an option changes the active index", () => {
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      const options = screen.getAllByRole("option");
      expect(options[0]!.getAttribute("aria-selected")).toBe("true");

      fireEvent.mouseEnter(options[1]!);
      expect(options[1]!.getAttribute("aria-selected")).toBe("true");
      expect(options[0]!.getAttribute("aria-selected")).toBe("false");
    });

    it("click outside calls onDismiss", () => {
      const onDismiss = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          onDismiss={onDismiss}
          visible={true}
        />,
      );
      // Click on document body (outside the dropdown)
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("click inside dropdown does not call onDismiss", () => {
      const onDismiss = vi.fn();
      render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          onDismiss={onDismiss}
          visible={true}
        />,
      );
      const listbox = screen.getByRole("listbox");
      fireEvent.mouseDown(listbox);
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe("partial change resets active index", () => {
    it("resets activeIndex to 0 when partial changes", () => {
      const { rerender } = render(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/h"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      // Move active to index 1
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });
      let options = screen.getAllByRole("option");
      expect(options[1]!.getAttribute("aria-selected")).toBe("true");

      // Change partial — should reset active index to 0
      rerender(
        <AutocompleteDropdown
          commands={testCommands}
          partial="/he"
          onSelect={vi.fn()}
          visible={true}
        />,
      );
      options = screen.getAllByRole("option");
      expect(options[0]!.getAttribute("aria-selected")).toBe("true");
    });
  });
});

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

  describe("terminal layout", () => {
    it("uses compact padding on items (py-1.5, not py-2.5)", () => {
      expect(SOURCE).toContain("py-1.5");
      expect(SOURCE).not.toContain("py-2.5");
    });

    it("uses terminal font (font-terminal) on the entire dropdown", () => {
      expect(SOURCE).toContain("font-terminal");
    });

    it("uses same font size for command name and description (text-sm)", () => {
      // Both should be text-sm, no text-xs on description
      expect(SOURCE).not.toContain("text-xs");
    });

    it("uses fixed-width column for command name to align descriptions", () => {
      // A min-width or w- class on the command name ensures alignment
      expect(SOURCE).toMatch(/min-w-|w-\[/);
    });
  });

  describe("keyboard event handling", () => {
    it("uses capture phase for keydown listener to intercept before TerminalInput", () => {
      // The third argument `true` enables capture phase
      expect(SOURCE).toContain("addEventListener(\"keydown\", handleKeyDown, true)");
    });

    it("removes listener with capture phase flag", () => {
      expect(SOURCE).toContain("removeEventListener(\"keydown\", handleKeyDown, true)");
    });

    it("stops propagation on arrow keys to prevent TerminalInput history handling", () => {
      expect(SOURCE).toContain("stopPropagation");
    });

    it("handles Escape key to dismiss dropdown via onDismiss callback", () => {
      // Escape should call onDismiss and stopPropagation so TerminalInput doesn't clear input
      expect(SOURCE).toContain("onDismiss");
      expect(SOURCE).toMatch(/Escape/);
    });
  });

  describe("dismiss behavior", () => {
    it("accepts an onDismiss prop", () => {
      expect(SOURCE).toContain("onDismiss");
    });

    it("listens for mousedown on document to dismiss on click-outside", () => {
      // Should add a mousedown listener to detect clicks outside the dropdown
      expect(SOURCE).toContain('"mousedown"');
    });

    it("uses a ref to detect clicks outside the dropdown container", () => {
      // Needs a ref on the container to check if click target is inside
      expect(SOURCE).toContain("useRef");
      expect(SOURCE).toContain("containerRef");
      expect(SOURCE).toContain(".contains(");
    });

    it("calls onDismiss when clicking outside", () => {
      // The mousedown handler should call onDismiss for outside clicks
      expect(SOURCE).toMatch(/onDismiss/);
    });
  });

  describe("Tab vs Enter distinction", () => {
    it("accepts an onFill prop for Tab completion", () => {
      expect(SOURCE).toContain("onFill");
    });

    it("calls onFill (not onSelect) on Tab key", () => {
      // Tab should fill the command into input, not execute it
      // The Tab branch should reference onFill
      expect(SOURCE).toMatch(/Tab[\s\S]*onFill|onFill[\s\S]*Tab/);
    });

    it("calls onSelect on Enter key (execute)", () => {
      // Enter should execute (select) the command
      expect(SOURCE).toMatch(/Enter[\s\S]*onSelect|onSelect[\s\S]*Enter/);
    });

    it("Tab and Enter are handled in separate branches", () => {
      // They should NOT be combined in the same condition anymore
      expect(SOURCE).not.toMatch(
        /e\.key === "Tab" \|\| e\.key === "Enter"/,
      );
    });
  });

  describe("argument hints", () => {
    it("renders usage hint from command definition", () => {
      // Should display cmd.usage when available
      expect(SOURCE).toContain("cmd.usage");
    });

    it("uses dim styling for usage hints", () => {
      // Hints should be visually distinct (dimmer) from the description
      expect(SOURCE).toMatch(/text-text-secondary|text-terminal-dim/);
    });
  });

  describe("alias support via getMatchingCommands (issue #118)", () => {
    it("imports getMatchingCommands from command-registry", () => {
      expect(SOURCE).toContain("getMatchingCommands");
    });

    it("does NOT have inline c.name.startsWith filter", () => {
      expect(SOURCE).not.toContain("c.name.startsWith");
    });
  });

  describe("accessibility", () => {
    it("has listbox role", () => {
      expect(SOURCE).toContain('role="listbox"');
    });

    it("has option role on items", () => {
      expect(SOURCE).toContain('role="option"');
    });

    it("marks active item with aria-selected", () => {
      expect(SOURCE).toContain("aria-selected");
    });

    it("options use <div> not <button> (listbox children must not be interactive elements) (#421)", () => {
      // role="option" elements inside a role="listbox" should not be
      // interactive elements like <button>. Use <div role="option"> instead.
      expect(SOURCE).not.toMatch(/<button[^>]*role="option"/);
      expect(SOURCE).toMatch(/<div[^>]*role="option"/);
    });

    it("options have tabIndex={-1} for programmatic focus", () => {
      // div[role="option"] elements need tabIndex so they can be focused programmatically
      expect(SOURCE).toMatch(/role="option"[\s\S]*?tabIndex=\{-1\}/);
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

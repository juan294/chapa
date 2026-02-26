// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AutocompleteDropdown } from "./AutocompleteDropdown";
import type { CommandDef } from "./command-registry";

afterEach(cleanup);

const COMMANDS: CommandDef[] = [
  { name: "/about", description: "About page", execute: vi.fn() },
  { name: "/help", description: "Show help", execute: vi.fn() },
  { name: "/admin", description: "Admin page", execute: vi.fn() },
];

describe("AutocompleteDropdown", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={false}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no matches", () => {
    const { container } = render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/xyz"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders matching commands", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(screen.getByText("/about")).toBeDefined();
    expect(screen.getByText("/admin")).toBeDefined();
  });

  it("calls onSelect when option clicked", () => {
    const onSelect = vi.fn();
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={onSelect}
        visible={true}
      />,
    );
    // Click the option row (role=option) instead of text to avoid multiple element matches
    const options = screen.getAllByRole("option");
    fireEvent.click(options[0]!);
    expect(onSelect).toHaveBeenCalledWith("/about");
  });

  it("highlights first option as active by default", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    const options = screen.getAllByRole("option");
    expect(options[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("navigates with ArrowDown", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("navigates with ArrowUp (wraps)", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const options = screen.getAllByRole("option");
    // Should wrap to last item
    expect(options[options.length - 1]?.getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("calls onSelect on Enter", () => {
    const onSelect = vi.fn();
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={onSelect}
        visible={true}
      />,
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("/about");
  });

  it("calls onFill on Tab when provided", () => {
    const onFill = vi.fn();
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        onFill={onFill}
        visible={true}
      />,
    );
    fireEvent.keyDown(document, { key: "Tab" });
    expect(onFill).toHaveBeenCalledWith("/about");
  });

  it("calls onDismiss on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        onDismiss={onDismiss}
        visible={true}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("updates active index on mouse enter", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[1]!);
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("shows command descriptions", () => {
    render(
      <AutocompleteDropdown
        commands={COMMANDS}
        partial="/a"
        onSelect={vi.fn()}
        visible={true}
      />,
    );
    expect(screen.getByText("About page")).toBeDefined();
    expect(screen.getByText("Admin page")).toBeDefined();
  });
});

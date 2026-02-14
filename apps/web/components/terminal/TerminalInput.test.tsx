// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TerminalInput } from "./TerminalInput";

afterEach(cleanup);

describe("TerminalInput", () => {
  it("renders with default prompt", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    expect(screen.getByText(/chapa/)).toBeDefined();
  });

  it("renders with custom prompt", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} prompt="studio" />);
    expect(screen.getByText(/studio/)).toBeDefined();
  });

  it("has an accessible input with aria-label", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    expect(input).toBeDefined();
    expect(input.tagName).toBe("INPUT");
  });

  it("accepts text input", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "/help" } });
    expect((input as HTMLInputElement).value).toBe("/help");
  });

  it("calls onSubmit with trimmed value on Enter", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: " /help " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("/help");
  });

  it("does not call onSubmit when input is empty", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears input after successful submit", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/help" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });

  it("calls onPartialChange when typing", () => {
    const onSubmit = vi.fn();
    const onPartialChange = vi.fn();
    render(
      <TerminalInput onSubmit={onSubmit} onPartialChange={onPartialChange} />,
    );
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "/he" } });
    expect(onPartialChange).toHaveBeenCalledWith("/he");
  });

  it("clears input on Escape", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/help" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("has autocomplete off and spellcheck disabled", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TerminalInput } from "./TerminalInput";

afterEach(cleanup);

describe("TerminalInput", () => {
  it("renders input with label", () => {
    render(<TerminalInput onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Terminal command input")).toBeDefined();
  });

  it("renders default prompt", () => {
    render(<TerminalInput onSubmit={vi.fn()} />);
    expect(screen.getByText(/chapa/)).toBeDefined();
  });

  it("renders custom prompt", () => {
    render(<TerminalInput onSubmit={vi.fn()} prompt="studio" />);
    expect(screen.getByText(/studio/)).toBeDefined();
  });

  it("calls onSubmit on Enter with trimmed value", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "  /about  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("/about");
  });

  it("does not submit empty input", () => {
    const onSubmit = vi.fn();
    render(<TerminalInput onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onPartialChange on input change", () => {
    const onChange = vi.fn();
    render(<TerminalInput onSubmit={vi.fn()} onPartialChange={onChange} />);
    const input = screen.getByLabelText("Terminal command input");
    fireEvent.change(input, { target: { value: "/he" } });
    expect(onChange).toHaveBeenCalledWith("/he");
  });

  it("clears input on Escape", () => {
    render(<TerminalInput onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/test" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("navigates history on ArrowUp", () => {
    const history = ["/first", "/second"];
    render(
      <TerminalInput onSubmit={vi.fn()} history={history} />,
    );
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.value).toBe("/second");
  });

  it("navigates back on ArrowDown", () => {
    const history = ["/first", "/second"];
    render(
      <TerminalInput onSubmit={vi.fn()} history={history} />,
    );
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.value).toBe("/second");
  });

  it("clears value on submit", () => {
    render(<TerminalInput onSubmit={vi.fn()} />);
    const input = screen.getByLabelText(
      "Terminal command input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "/about" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("");
  });
});

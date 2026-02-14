// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import { TerminalInput } from "./TerminalInput";

afterEach(cleanup);

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "TerminalInput.tsx"),
  "utf-8",
);

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

  describe("component directive", () => {
    it("has 'use client' directive", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });
  });

  describe("autoFocus default (#228)", () => {
    it("defaults autoFocus to false so it does not steal focus on mount", () => {
      expect(SOURCE).toMatch(/autoFocus\s*=\s*false/);
    });

    it("does NOT default autoFocus to true", () => {
      expect(SOURCE).not.toMatch(/autoFocus\s*=\s*true/);
    });
  });

  describe("wrapper div keyboard accessibility (#231)", () => {
    it("does not have onClick on the wrapper div without keyboard equivalent", () => {
      const hasOnClick = SOURCE.includes("onClick={() => inputRef.current?.focus()}");
      const hasOnKeyDown = SOURCE.includes("onKeyDown");

      if (hasOnClick) {
        expect(hasOnKeyDown).toBe(true);
      }
    });
  });

  describe("accessibility (source)", () => {
    it("has aria-label on the input", () => {
      expect(SOURCE).toContain("aria-label=");
    });
  });
});

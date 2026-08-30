// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { TerminalInput } from "./TerminalInput";
import { LanguageProvider } from "@/lib/i18n";
import { es } from "@/lib/i18n/dictionaries/es";

afterEach(cleanup);

describe("TerminalInput", () => {
  it("renders input with label", () => {
    render(<TerminalInput onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Terminal command input")).toBeDefined();
  });

  it("exposes combobox ownership and the active suggestion", () => {
    render(
      <TerminalInput
        onSubmit={vi.fn()}
        suggestionsVisible
        suggestionsListboxId="studio-suggestions"
        activeSuggestionId="studio-suggestions-option-1"
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-controls")).toBe("studio-suggestions");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      "studio-suggestions-option-1",
    );
  });

  it("does not claim listbox ownership while suggestions are closed", () => {
    render(
      <TerminalInput
        onSubmit={vi.fn()}
        suggestionsVisible={false}
        suggestionsListboxId="studio-suggestions"
      />,
    );

    const input = screen.getByRole("combobox");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-controls")).toBe(false);
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
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

  describe("imperative handle via ref", () => {
    it("clear() resets input value and history index", () => {
      const ref = { current: null as import("./TerminalInput").TerminalInputHandle | null };
      render(<TerminalInput onSubmit={vi.fn()} ref={ref} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "/test" } });
      expect(input.value).toBe("/test");
      act(() => {
        ref.current?.clear();
      });
      expect(input.value).toBe("");
    });

    it("focus() sets focus on the input element", () => {
      const ref = { current: null as import("./TerminalInput").TerminalInputHandle | null };
      render(<TerminalInput onSubmit={vi.fn()} ref={ref} />);
      const input = screen.getByLabelText("Terminal command input");
      act(() => {
        ref.current?.focus();
      });
      expect(document.activeElement).toBe(input);
    });
  });

  describe("autoFocus behavior", () => {
    it("focuses input after delay when autoFocus is true", () => {
      vi.useFakeTimers();
      render(<TerminalInput onSubmit={vi.fn()} autoFocus={true} />);
      const input = screen.getByLabelText("Terminal command input");

      // Input is focused after 300ms delay
      vi.advanceTimersByTime(300);
      expect(document.activeElement).toBe(input);
      vi.useRealTimers();
    });

    it("does not auto-focus when autoFocus is false", () => {
      render(<TerminalInput onSubmit={vi.fn()} autoFocus={false} />);
      const input = screen.getByLabelText("Terminal command input");
      expect(document.activeElement).not.toBe(input);
    });
  });

  describe("history navigation edge cases", () => {
    it("ArrowUp with empty history is a no-op", () => {
      render(<TerminalInput onSubmit={vi.fn()} history={[]} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("");
    });

    it("ArrowUp at end of history stays at last item", () => {
      const history = ["/first", "/second"];
      render(<TerminalInput onSubmit={vi.fn()} history={history} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      // Navigate to the end of history
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/second");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/first");
      // One more ArrowUp should stay at the oldest item
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/first");
    });

    it("ArrowDown from index 0 clears input", () => {
      const history = ["/first", "/second"];
      render(<TerminalInput onSubmit={vi.fn()} history={history} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      // Go up once
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/second");
      // Go down should clear
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.value).toBe("");
    });

    it("ArrowDown with no history index (-1) clears input", () => {
      render(<TerminalInput onSubmit={vi.fn()} history={["/first"]} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      // ArrowDown without having navigated up first
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.value).toBe("");
    });

    it("ArrowUp calls onPartialChange with history value", () => {
      const onChange = vi.fn();
      const history = ["/first", "/second"];
      render(<TerminalInput onSubmit={vi.fn()} history={history} onPartialChange={onChange} />);
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(onChange).toHaveBeenCalledWith("/second");
    });

    it("ArrowDown calls onPartialChange with history value", () => {
      const onChange = vi.fn();
      const history = ["/first", "/second"];
      render(<TerminalInput onSubmit={vi.fn()} history={history} onPartialChange={onChange} />);
      const input = screen.getByLabelText("Terminal command input");
      // Go up twice
      fireEvent.keyDown(input, { key: "ArrowUp" });
      fireEvent.keyDown(input, { key: "ArrowUp" });
      onChange.mockClear();
      // Go down
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith("/second");
    });

    it("ArrowDown past beginning calls onPartialChange with empty string", () => {
      const onChange = vi.fn();
      render(<TerminalInput onSubmit={vi.fn()} history={["/first"]} onPartialChange={onChange} />);
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.keyDown(input, { key: "ArrowUp" });
      onChange.mockClear();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(onChange).toHaveBeenCalledWith("");
    });

    it("Escape calls onPartialChange with empty string", () => {
      const onChange = vi.fn();
      render(<TerminalInput onSubmit={vi.fn()} onPartialChange={onChange} />);
      const input = screen.getByLabelText("Terminal command input");
      fireEvent.change(input, { target: { value: "/test" } });
      onChange.mockClear();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onChange).toHaveBeenCalledWith("");
    });
  });

  describe("input change resets history index", () => {
    it("typing after history navigation resets history position", () => {
      const history = ["/first", "/second"];
      render(<TerminalInput onSubmit={vi.fn()} history={history} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      // Navigate up
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/second");
      // Type something new
      fireEvent.change(input, { target: { value: "/new" } });
      expect(input.value).toBe("/new");
      // ArrowUp should start from the beginning of history again
      fireEvent.keyDown(input, { key: "ArrowUp" });
      expect(input.value).toBe("/second");
    });
  });

  // #1109 (UX-H3): the placeholder and aria-label must come from the i18n
  // dictionary, not a hardcoded English literal, so the primary interaction
  // affordance is translated on this Spanish-default site.
  describe("i18n (#1109)", () => {
    it("renders the English placeholder via the useTranslation fallback (no provider)", () => {
      render(<TerminalInput onSubmit={vi.fn()} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      expect(input.placeholder).toBe("Type / for commands...");
    });

    it("renders the Spanish placeholder and aria-label when wrapped in LanguageProvider with the es dictionary", () => {
      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <TerminalInput onSubmit={vi.fn()} />
        </LanguageProvider>,
      );
      const input = screen.getByLabelText(
        "Entrada de comando de terminal",
      ) as HTMLInputElement;
      expect(input.placeholder).toBe("Escribe / para ver comandos...");
    });

    it("keeps the stable #terminal-command-input id regardless of locale", () => {
      render(
        <LanguageProvider initialLocale="es" dictionary={es}>
          <TerminalInput onSubmit={vi.fn()} />
        </LanguageProvider>,
      );
      expect(document.querySelector("#terminal-command-input")).not.toBeNull();
    });
  });

  // #1111 (UX-M2): iOS Safari auto-zooms any focused control below 16px
  // computed font-size and does not zoom back out on blur.
  describe("mobile font-size (#1111)", () => {
    it("uses a ≥16px-equivalent font-size class on small viewports, reverting to text-sm at sm and up", () => {
      render(<TerminalInput onSubmit={vi.fn()} />);
      const wrapper = screen.getByLabelText("Terminal command input").closest("div.flex");
      expect(wrapper?.className).toContain("text-base");
      expect(wrapper?.className).toContain("sm:text-sm");
    });

    it("disables autoCapitalize and autoCorrect on the terminal input", () => {
      render(<TerminalInput onSubmit={vi.fn()} />);
      const input = screen.getByLabelText("Terminal command input") as HTMLInputElement;
      expect(input.getAttribute("autocapitalize")).toBe("off");
      expect(input.getAttribute("autocorrect")).toBe("off");
    });

    it("keeps the prompt and input on the same shared font-size (baseline alignment)", () => {
      render(<TerminalInput onSubmit={vi.fn()} />);
      const input = screen.getByLabelText("Terminal command input");
      // Neither the input nor the prompt span declares its own text-size
      // utility — both inherit font-size from the shared wrapper's
      // text-base/sm:text-sm via normal CSS cascade, so they can never
      // drift out of sync in the flex row.
      expect(input.className).not.toMatch(/(?:^|\s)text-(?:xs|sm|base|lg|xl)(?:\s|$)/);
      const prompt = screen.getByText(/chapa/);
      expect(prompt.className).not.toMatch(/(?:^|\s)text-(?:xs|sm|base|lg|xl)(?:\s|$)/);
    });
  });
});

// #1214 — the field is a bordered 46px control with room for a trailing
// affordance, not a bare line sitting on a divider.
describe("TerminalInput — v2 field (#1214)", () => {
  it("meets the 46px primary-action height", () => {
    const { container } = render(<TerminalInput onSubmit={() => {}} />);
    const field = container.firstElementChild as HTMLElement;
    expect(field.className).toContain("min-h-[46px]");
    expect(field.className).toContain("rounded-lg");
    expect(field.className).toContain("border");
  });

  it("renders a trailing affordance inside the field", () => {
    const { container } = render(
      <TerminalInput onSubmit={() => {}} trailing={<kbd>/</kbd>} />,
    );
    const field = container.firstElementChild as HTMLElement;
    const kbd = field.querySelector("kbd");
    expect(kbd).not.toBeNull();
    expect(kbd!.textContent).toBe("/");
  });

  it("renders nothing extra when there is no trailing affordance", () => {
    const { container } = render(<TerminalInput onSubmit={() => {}} />);
    expect(container.querySelector("kbd")).toBeNull();
  });
});


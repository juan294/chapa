// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { LanguageSwitcher } from "./LanguageSwitcher";

const mockSetLocale = vi.fn();
let mockLocale = "en";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: mockSetLocale,
    t: (key: string) => key,
  }),
}));

describe("LanguageSwitcher", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocale = "en";
  });

  describe("collapsed state", () => {
    it("shows EN label when locale is en", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("EN")).toBeDefined();
    });

    it("shows ES label when locale is es", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);
      // There are two buttons with expanded:false (the trigger and the options use role="option")
      // Use queryAllByRole and find the one with aria-haspopup
      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("ES")).toBeDefined();
    });

    it("renders both options in DOM even when collapsed", () => {
      render(<LanguageSwitcher />);
      const allOptions = screen.getAllByRole("option");
      expect(allOptions).toHaveLength(2);
    });

    it("falls back to first language when locale is unknown", () => {
      mockLocale = "ja" as "en";
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      expect(within(toggleButton).getByText("EN")).toBeDefined();
    });
  });

  describe("expanded state", () => {
    it("keeps the menu above page content", () => {
      render(<LanguageSwitcher />);
      expect(screen.getByRole("group").className).toContain("z-50");
      expect(screen.getByRole("listbox").className).toContain("z-50");
    });

    it("expands and shows both options on trigger click", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    it("marks current locale option as aria-selected=true", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const esOption = screen.getByRole("option", { name: /Español/ });
      expect(esOption.getAttribute("aria-selected")).toBe("true");
    });

    it("marks non-current option as aria-selected=false", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const enOption = screen.getByRole("option", { name: /English/ });
      expect(enOption.getAttribute("aria-selected")).toBe("false");
    });

    it("calls setLocale with 'es' when ES is clicked from EN", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.click(screen.getByRole("option", { name: /Español/ }));
      expect(mockSetLocale).toHaveBeenCalledWith("es");
    });

    it("calls setLocale with 'en' when EN is clicked from ES", () => {
      mockLocale = "es";
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.click(screen.getByRole("option", { name: /English/ }));
      expect(mockSetLocale).toHaveBeenCalledWith("en");
    });

    it("closes after selecting a language", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.click(screen.getByRole("option", { name: /Español/ }));
      const groupContainer = screen.getByRole("group");
      const hiddenDropdown = groupContainer.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
      expect(hiddenDropdown).not.toBeNull();
    });
  });

  describe("closing behavior", () => {
    it("closes when clicking outside the container", () => {
      render(
        <div>
          <button data-testid="outside">Outside</button>
          <LanguageSwitcher />
        </div>
      );
      const trigger = screen.getByRole("button", { expanded: false });
      fireEvent.click(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      fireEvent.mouseDown(screen.getByTestId("outside"));
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });

    it("does not close when clicking inside the container", () => {
      render(<LanguageSwitcher />);
      const trigger = screen.getByRole("button", { expanded: false });
      fireEvent.click(trigger);
      const listbox = screen.getByRole("listbox");
      fireEvent.mouseDown(listbox);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    it("closes when pressing Escape", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.keyDown(document, { key: "Escape" });
      const groupContainer = screen.getByRole("group");
      const hiddenDropdown = groupContainer.querySelector('[class*="opacity-0"][class*="pointer-events-none"]');
      expect(hiddenDropdown).not.toBeNull();
    });
  });

  describe("accessibility", () => {
    it("has accessible group label from i18n key", () => {
      render(<LanguageSwitcher />);
      expect(screen.getByRole("group").getAttribute("aria-label")).toBe(
        "aria.languageSwitcher"
      );
    });

    it("reflects aria-expanded state correctly", () => {
      render(<LanguageSwitcher />);
      const toggle = screen.getByRole("button", { expanded: false });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
    });

    it("toggle button has aria-haspopup=listbox", () => {
      render(<LanguageSwitcher />);
      const toggle = screen.getByRole("button", { expanded: false });
      expect(toggle.getAttribute("aria-haspopup")).toBe("listbox");
    });
  });

  describe("keyboard navigation", () => {
    it("focuses first option when dropdown opens", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const options = screen.getAllByRole("option");
      expect(document.activeElement).toBe(options[0]);
    });

    it("ArrowDown moves focus to next option", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0]!.focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(document.activeElement).toBe(options[1]);
    });

    it("ArrowUp moves focus to previous option", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[1]!.focus();
      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("ArrowDown wraps from last to first", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[options.length - 1]!.focus();
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("ArrowUp wraps from first to last", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0]!.focus();
      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(document.activeElement).toBe(options[options.length - 1]);
    });

    it("Home key jumps to first option", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[1]!.focus();
      fireEvent.keyDown(listbox, { key: "Home" });
      expect(document.activeElement).toBe(options[0]);
    });

    it("End key jumps to last option", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0]!.focus();
      fireEvent.keyDown(listbox, { key: "End" });
      expect(document.activeElement).toBe(options[options.length - 1]);
    });

    it("Enter selects focused option and closes", () => {
      mockLocale = "en";
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      // ES is index 1
      options[1]!.focus();
      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(mockSetLocale).toHaveBeenCalledWith("es");
    });

    it("Enter with no focused option does nothing", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      (document.activeElement as HTMLElement)?.blur();
      fireEvent.keyDown(listbox, { key: "Enter" });
      expect(mockSetLocale).not.toHaveBeenCalled();
    });

    it("Escape closes dropdown and returns focus to trigger", () => {
      render(<LanguageSwitcher />);
      const toggleButton = screen.getByRole("button", { expanded: false });
      fireEvent.click(toggleButton);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(toggleButton);
    });

    it("unrecognized keys do nothing", () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      const listbox = screen.getByRole("listbox");
      const options = screen.getAllByRole("option");
      options[0]!.focus();
      fireEvent.keyDown(listbox, { key: "x" });
      expect(document.activeElement).toBe(options[0]);
      expect(mockSetLocale).not.toHaveBeenCalled();
    });
  });

  describe("event propagation", () => {
    it("stops propagation on toggle click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("stops propagation on listbox click", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.click(screen.getByRole("listbox"));
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it("stops propagation on option selection", () => {
      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <LanguageSwitcher />
        </div>
      );
      fireEvent.click(screen.getByRole("button", { expanded: false }));
      fireEvent.click(screen.getByRole("option", { name: /Español/ }));
      expect(parentHandler).not.toHaveBeenCalled();
    });
  });
});

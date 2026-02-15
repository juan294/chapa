// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDropdownMenu } from "./useDropdownMenu";

describe("useDropdownMenu", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("starts with isOpen = false", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));
      expect(result.current.isOpen).toBe(false);
    });

    it("starts with activeIndex = -1", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));
      expect(result.current.activeIndex).toBe(-1);
    });
  });

  describe("setIsOpen", () => {
    it("can open the dropdown", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it("can close the dropdown", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });
      act(() => {
        result.current.setIsOpen(false);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("click-outside close", () => {
    it("closes the dropdown when clicking outside the container", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const ref = { current: container };

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });
      expect(result.current.isOpen).toBe(true);

      // Click outside the container
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(result.current.isOpen).toBe(false);

      document.body.removeChild(container);
    });

    it("does NOT close the dropdown when clicking inside the container", () => {
      const container = document.createElement("div");
      const child = document.createElement("button");
      container.appendChild(child);
      document.body.appendChild(container);
      const ref = { current: container };

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Click inside the container
      act(() => {
        child.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });

      expect(result.current.isOpen).toBe(true);

      document.body.removeChild(container);
    });

    it("does not add listener when dropdown is closed", () => {
      const ref = { current: document.createElement("div") };
      const addSpy = vi.spyOn(document, "addEventListener");

      renderHook(() => useDropdownMenu(ref));

      // Should not have added mousedown listener (dropdown is closed)
      const mousedownCalls = addSpy.mock.calls.filter(
        ([event]) => event === "mousedown",
      );
      expect(mousedownCalls).toHaveLength(0);
    });
  });

  describe("Escape key close", () => {
    it("closes the dropdown when Escape is pressed", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });

      expect(result.current.isOpen).toBe(false);
    });

    it("does NOT close the dropdown for non-Escape keys", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe("arrow key navigation", () => {
    function createMenuContainer(): HTMLDivElement {
      const container = document.createElement("div");
      for (let i = 0; i < 3; i++) {
        const item = document.createElement("button");
        item.setAttribute("role", "menuitem");
        item.textContent = `Item ${i}`;
        container.appendChild(item);
      }
      document.body.appendChild(container);
      return container;
    }

    it("ArrowDown focuses the first menu item when none is focused", () => {
      const container = createMenuContainer();
      const ref = { current: container };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(document.activeElement).toBe(items[0]);

      document.body.removeChild(container);
    });

    it("ArrowDown wraps from last item to first", () => {
      const container = createMenuContainer();
      const ref = { current: container };
      const items = container.querySelectorAll('[role="menuitem"]');

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Focus the last item
      (items[2] as HTMLElement).focus();

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });

      expect(document.activeElement).toBe(items[0]);

      document.body.removeChild(container);
    });

    it("ArrowUp wraps from first item to last", () => {
      const container = createMenuContainer();
      const ref = { current: container };
      const items = container.querySelectorAll('[role="menuitem"]');

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Focus the first item
      (items[0] as HTMLElement).focus();

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
      });

      expect(document.activeElement).toBe(items[2]);

      document.body.removeChild(container);
    });

    it("Home key focuses the first item", () => {
      const container = createMenuContainer();
      const ref = { current: container };
      const items = container.querySelectorAll('[role="menuitem"]');

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Focus the last item
      (items[2] as HTMLElement).focus();

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
        );
      });

      expect(document.activeElement).toBe(items[0]);

      document.body.removeChild(container);
    });

    it("End key focuses the last item", () => {
      const container = createMenuContainer();
      const ref = { current: container };
      const items = container.querySelectorAll('[role="menuitem"]');

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Focus the first item
      (items[0] as HTMLElement).focus();

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "End", bubbles: true }),
        );
      });

      expect(document.activeElement).toBe(items[2]);

      document.body.removeChild(container);
    });

    it("does nothing when no menu items exist", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const ref = { current: container };

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      // Should not throw
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
      });

      document.body.removeChild(container);
    });
  });

  describe("cleanup", () => {
    it("removes event listeners when dropdown closes", () => {
      const ref = { current: document.createElement("div") };
      const removeSpy = vi.spyOn(document, "removeEventListener");

      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setIsOpen(true);
      });

      act(() => {
        result.current.setIsOpen(false);
      });

      // Should have removed mousedown and keydown listeners
      const mousedownRemovals = removeSpy.mock.calls.filter(
        ([event]) => event === "mousedown",
      );
      const keydownRemovals = removeSpy.mock.calls.filter(
        ([event]) => event === "keydown",
      );

      expect(mousedownRemovals.length).toBeGreaterThan(0);
      expect(keydownRemovals.length).toBeGreaterThan(0);
    });
  });

  describe("setActiveIndex", () => {
    it("allows manual activeIndex control", () => {
      const ref = { current: document.createElement("div") };
      const { result } = renderHook(() => useDropdownMenu(ref));

      act(() => {
        result.current.setActiveIndex(2);
      });

      expect(result.current.activeIndex).toBe(2);
    });
  });
});

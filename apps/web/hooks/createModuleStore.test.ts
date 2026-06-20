// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createModuleStore } from "./createModuleStore";

describe("createModuleStore", () => {
  describe("snapshot", () => {
    it("returns the initial value from getSnapshot", () => {
      const store = createModuleStore<number>(0);
      expect(store.getSnapshot()).toBe(0);
    });

    it("returns the updated value after set", () => {
      const store = createModuleStore<number>(0);
      store.set(42);
      expect(store.getSnapshot()).toBe(42);
    });

    it("supports object values", () => {
      const store = createModuleStore<{ open: boolean }>({ open: false });
      store.set({ open: true });
      expect(store.getSnapshot()).toEqual({ open: true });
    });

    it("supports null values", () => {
      const store = createModuleStore<string | null>(null);
      expect(store.getSnapshot()).toBeNull();
      store.set("ready");
      expect(store.getSnapshot()).toBe("ready");
    });
  });

  describe("subscribers", () => {
    it("notifies subscribers on set", () => {
      const store = createModuleStore<number>(0);
      const sub = vi.fn();
      store.subscribe(sub);
      store.set(1);
      expect(sub).toHaveBeenCalledTimes(1);
    });

    it("notifies all subscribers on set", () => {
      const store = createModuleStore<number>(0);
      const a = vi.fn();
      const b = vi.fn();
      store.subscribe(a);
      store.subscribe(b);
      store.set(1);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", () => {
      const store = createModuleStore<number>(0);
      const sub = vi.fn();
      const unsubscribe = store.subscribe(sub);
      unsubscribe();
      store.set(1);
      expect(sub).not.toHaveBeenCalled();
    });

    it("returns the latest value to subscribers via getSnapshot", () => {
      const store = createModuleStore<number>(0);
      let observed = -1;
      store.subscribe(() => {
        observed = store.getSnapshot();
      });
      store.set(7);
      expect(observed).toBe(7);
    });
  });

  describe("getServerSnapshot", () => {
    it("returns the configured server snapshot value", () => {
      const store = createModuleStore<string | null>("client", {
        serverSnapshot: null,
      });
      expect(store.getServerSnapshot()).toBeNull();
    });

    it("defaults the server snapshot to the initial value", () => {
      const store = createModuleStore<number>(5);
      expect(store.getServerSnapshot()).toBe(5);
    });
  });

  describe("useStore React hook", () => {
    it("returns the current snapshot", () => {
      const store = createModuleStore<number>(3);
      const { result } = renderHook(() => store.useStore());
      expect(result.current).toBe(3);
    });

    it("re-renders subscribed components when the value changes", () => {
      const store = createModuleStore<number>(0);
      const { result } = renderHook(() => store.useStore());
      expect(result.current).toBe(0);
      act(() => {
        store.set(99);
      });
      expect(result.current).toBe(99);
    });

    it("does not re-render after the component unmounts", () => {
      const store = createModuleStore<number>(0);
      const { result, unmount } = renderHook(() => store.useStore());
      expect(result.current).toBe(0);
      unmount();
      // No subscribers should remain after unmount.
      act(() => {
        store.set(1);
      });
      expect(store.getSnapshot()).toBe(1);
    });
  });
});

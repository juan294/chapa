// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useUnsavedNavigation } from "./useUnsavedNavigation";
import { navigateDocument, navigateInApp } from "@/lib/navigation";

vi.mock("@/lib/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/navigation")>(),
  navigateDocument: vi.fn(),
}));
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.clearAllMocks(); });

function click(href: string, options: MouseEventInit = {}, attributes: Record<string, string> = {}) {
  const anchor = document.createElement("a");
  anchor.href = href;
  for (const [key, value] of Object.entries(attributes)) anchor.setAttribute(key, value);
  document.body.appendChild(anchor);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...options });
  // Prevent jsdom from attempting default navigation after capturing the guard result.
  let preventedAtTarget: boolean | undefined;
  anchor.addEventListener("click", () => { preventedAtTarget = event.defaultPrevented; event.preventDefault(); });
  anchor.dispatchEvent(event);
  return { event, preventedAtTarget };
}

describe("unsaved Studio navigation", () => {
  it("routes app-owned departures through native navigation while edits are unsaved", () => {
    renderHook(() => useUnsavedNavigation(true));
    const push = vi.fn();
    navigateInApp("/settings", push);
    expect(push).not.toHaveBeenCalled();
    expect(navigateDocument).toHaveBeenCalledWith(new URL("/settings", window.location.href).href);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
  it("intercepts nested logo/settings links before Next can navigate", () => {
    renderHook(() => useUnsavedNavigation(true));
    const { event, preventedAtTarget } = click("/settings");
    expect(event.defaultPrevented).toBe(true);
    expect(preventedAtTarget).toBeUndefined();
    expect(navigateDocument).toHaveBeenCalledOnce();
  });
  it.each([
    ["#section", {}, {}],
    ["/settings", { ctrlKey: true }, {}],
    ["/settings", { metaKey: true }, {}],
    ["/settings", { shiftKey: true }, {}],
    ["/settings", { altKey: true }, {}],
    ["/settings", { button: 1 }, {}],
    ["/settings", {}, { target: "_blank" }],
    ["/settings", {}, { download: "badge.svg" }],
    ["https://example.org/", {}, {}],
  ] as const)("preserves excluded anchor behavior %s %j %j", (href, options, attributes) => {
    renderHook(() => useUnsavedNavigation(true));
    const { preventedAtTarget } = click(href, options, attributes);
    expect(preventedAtTarget).toBe(false);
    expect(navigateDocument).not.toHaveBeenCalled();
  });
  it("leaves clean/demo routing alone and removes all guards after cleanup", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedNavigation(dirty), { initialProps: { dirty: false } });
    const push = vi.fn();
    navigateInApp("/settings", push);
    expect(push).toHaveBeenCalledWith("/settings");
    rerender({ dirty: true });
    unmount();
    navigateInApp("/settings", push);
    expect(push).toHaveBeenCalledTimes(2);
    expect(navigateDocument).not.toHaveBeenCalled();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });
  it("does not leave or prompt for the current document", () => {
    renderHook(() => useUnsavedNavigation(true));
    const push = vi.fn();
    navigateInApp(window.location.pathname + "#section", push);
    expect(push).toHaveBeenCalledOnce();
    expect(navigateDocument).not.toHaveBeenCalled();
  });
});

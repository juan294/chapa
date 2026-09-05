// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useInsightsImport } from "./use-insights-import";

vi.mock("@/lib/insights/parser", () => ({
  parseInsightsHtml: vi.fn(() => ({ tool: "claude-code" })),
}));

const originalLocation = window.location;
const reload = vi.fn();
const file = { size: 100, text: async () => "<html>report</html>" } as File;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("insights notification identity and reload (#1292)", () => {
  it("gives identical failed imports fresh identities, including after dismissal", async () => {
    const oversized = { size: 11 * 1024 * 1024 } as File;
    const { result } = renderHook(() => useInsightsImport("octocat"));
    await act(() => result.current.importFile(oversized));
    const first = result.current.toast;
    expect(first?.id).toEqual(expect.any(Number));
    await act(() => result.current.importFile(oversized));
    expect(result.current.toast?.message).toBe(first?.message);
    expect(result.current.toast?.id).not.toBe(first?.id);
    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
    await act(() => result.current.importFile(oversized));
    expect(result.current.toast?.id).toBeGreaterThan(first!.id);
  });

  it("assigns processing, recalculation and success distinct ids and reloads only 2.5s after completion", async () => {
    let finishUpload!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(new Promise<Response>(resolve => { finishUpload = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ adjustedComposite: 70 }), { status: 200 }));
    const { result } = renderHook(() => useInsightsImport("octocat"));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.importFile(file); });
    const processingId = result.current.toast!.id;
    expect(result.current.toast!.type).toBe("loading");
    await act(() => vi.advanceTimersByTimeAsync(6000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => {
      finishUpload(new Response(JSON.stringify({ craftScore: {craftScore: 72, tier: "Expert"} }), {status: 200}));
      await pending;
    });
    expect(result.current.toast!.type).toBe("success");
    // The intermediate recalculation notification also consumes an identity.
    expect(result.current.toast!.id).toBe(processingId + 2);
    await act(() => vi.advanceTimersByTimeAsync(2499));
    expect(reload).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("cancels the completion reload when Settings unmounts", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ craftScore: {craftScore: 72, tier: "Expert"} }), {status: 200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({adjustedComposite: 70}), {status: 200}));
    const view = renderHook(() => useInsightsImport("octocat"));
    await act(() => view.result.current.importFile(file));
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(reload).not.toHaveBeenCalled();
  });
});

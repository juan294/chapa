// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useInsightsImport } from "./use-insights-import";

vi.mock("@/lib/insights/parser", () => ({
  parseInsightsHtml: vi.fn(() => ({ tool: "claude-code" })),
}));
vi.mock("@/lib/insights/report-craft-import", () => ({
  parseReportCraftHtml: vi.fn(() => ({ schemaVersion: "v7.2", tool: "claude-code", reportPeriod: { start: "2026-09-01", end: "2026-09-07" }, totalSessions: 10, outcomes: [{ label: "Failed", count: 10 }] })),
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

describe("report-derived Craft import", () => {
  const published = (score: number) => ({ persisted: true, publication: "published", refreshed: true, scoring: {}, craft: { status: "scored", report: { result: { point: { displayLabel: String(score) } } } } });
  it("discards a pending confirmation after an account or policy change", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "same_period_requires_explicit_correction", supersedesReportId: "parent" }), { status: 409 }));
    const { result, rerender } = renderHook(({ login, policy }) => useInsightsImport(login, policy), { initialProps: { login: "alice", policy: "v7.2" as "v6" | "v7.2" } });
    await act(() => result.current.importFile(file));
    expect(result.current.pendingConfirmation).toBe("replacement");
    rerender({ login: "bob", policy: "v6" });
    expect(result.current.pendingConfirmation).toBeNull();
    await act(() => result.current.confirmImport());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("allows only one import while the selected file is still being read", async () => {
    let finish!: (text: string) => void;
    const slow = { size: 100, text: () => new Promise<string>(resolve => { finish = resolve; }) } as File;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(published(0)), { status: 200 }));
    const { result } = renderHook(() => useInsightsImport("alice", "v7.2"));
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.importFile(slow); });
    expect(result.current.processing).toBe(true);
    await act(() => result.current.importFile(file));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { finish("<html>report</html>"); await pending; });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([57, 0])("publishes Craft%s without recalculating or claiming a core increase", async score => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(published(score)), { status: 200 }));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.toast).toMatchObject({ type: "success", message: `Craft: ${score}/100` });
    expect(result.current.toast?.detail).not.toContain("undefined");
    expect(result.current.cooldownActive).toBe(false);
    expect(localStorage.getItem("chapa_insights_last_submitted_octocat")).toBeNull();
  });
  it("requires an explicit same-period replacement and carries its parent identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "same_period_requires_explicit_correction", supersedesReportId: "parent" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(published(57)), { status: 200 }));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    expect(result.current.pendingConfirmation).toBe("replacement");
    await act(() => result.current.confirmImport());
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string).supersedesReportId).toBe("parent");
  });
  it.each([
    { persisted: false, publication: "not_published", refreshed: false },
    { persisted: true, publication: "pending", refreshed: false },
    { ...published(57), refreshed: false },
  ])("does not announce success or block retry after partial failure (%j)", async response => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    expect(result.current.toast?.type).not.toBe("success");
    expect(result.current.cooldownActive).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(reload).not.toHaveBeenCalled();
  });
  it.each(["insufficient", "older", "outside_window"])("does not attribute retained Craft to a newly %s report", async reportSelection => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...published(57), reportSelection })));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    expect(result.current.toast?.message).toBe("Report saved; your current Craft score is unchanged");
    expect(result.current.toast?.type).toBe("info");
  });
  it("repairs a saved publication using the retained draft without rereading a file", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ persisted: true, publication: "pending", refreshed: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify(published(57))));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    expect(result.current.pendingConfirmation).toBe("retry");
    await act(() => result.current.confirmImport());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]!.body).toBe(fetchMock.mock.calls[0]![1]!.body);
    expect(result.current.toast?.type).toBe("success");
  });
  it("canceling the inline prompt publishes nothing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "same_period_requires_explicit_correction", supersedesReportId: "parent" }), { status: 409 }));
    const { result } = renderHook(() => useInsightsImport("octocat", "v7.2"));
    await act(() => result.current.importFile(file));
    act(() => result.current.cancelImport());
    expect(result.current.pendingConfirmation).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

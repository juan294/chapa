// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseInsightsHtml: vi.fn(),
}));

vi.mock("@/lib/insights/parser", () => ({
  parseInsightsHtml: mocks.parseInsightsHtml,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "userMenu.insightsCooldownPrefix": "Available again on ",
        "userMenu.insightsFileTooLarge": "File too large",
        "userMenu.insightsFileTooLargeDetail": "Choose a file under 10 MB",
        "userMenu.insightsProcessing": "Processing",
        "userMenu.insightsRecalculating": "Recalculating",
        "userMenu.insightsCraftResult": "Craft {craftScore}, {craftTier}",
        "userMenu.insightsScoreUpdated": "Impact score {score}",
        "userMenu.insightsImported": "Insights imported",
        "userMenu.insightsImportedDetail": "Scores will update later",
        "userMenu.insightsImportFailed": "Import failed",
        "userMenu.insightsImportFailedDetail": "Try again",
        "userMenu.craftTierExpert": "Expert translated",
      })[key] ?? key,
  }),
}));

import {
  INSIGHTS_COOLDOWN_MS,
  useInsightsImport,
} from "./use-insights-import";

function file(contents = "<html />", size = contents.length): File {
  return { size, text: vi.fn().mockResolvedValue(contents) } as unknown as File;
}

function response(ok: boolean, body: unknown = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  mocks.parseInsightsHtml.mockReset().mockReturnValue({ messages: 12 });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useInsightsImport", () => {
  it("hydrates an active cooldown from the login-specific storage key", async () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    localStorage.setItem(
      "chapa_insights_last_submitted_octocat",
      new Date(now.getTime() - INSIGHTS_COOLDOWN_MS + 60_000).toISOString(),
    );

    const { result } = renderHook(() => useInsightsImport("octocat"));

    await waitFor(() => expect(result.current.cooldownActive).toBe(true));
    expect(result.current.cooldownTooltip).toMatch(/^Available again on /);
  });

  it("ignores malformed and expired cooldown timestamps", async () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    localStorage.setItem("chapa_insights_last_submitted_bad", "not-a-date");
    localStorage.setItem(
      "chapa_insights_last_submitted_old",
      new Date(now.getTime() - INSIGHTS_COOLDOWN_MS).toISOString(),
    );

    const malformed = renderHook(() => useInsightsImport("bad"));
    const expired = renderHook(() => useInsightsImport("old"));

    await waitFor(() => expect(Date.now).toHaveBeenCalled());
    expect(malformed.result.current.cooldownActive).toBe(false);
    expect(expired.result.current.cooldownActive).toBe(false);
  });

  it("rejects an oversized file without parsing or uploading it", async () => {
    const { result } = renderHook(() => useInsightsImport("octocat"));

    await act(() => result.current.importFile(file("ignored", 10 * 1024 * 1024 + 1)));

    expect(result.current.toast).toEqual({
      message: "File too large",
      detail: "Choose a file under 10 MB",
      type: "error",
    });
    expect(mocks.parseInsightsHtml).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("parses, uploads, recalculates, stores the cooldown, and reports translated results", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response(true, { craftScore: { craftScore: 91, tier: "Expert" } }),
      )
      .mockResolvedValueOnce(
        response(true, { adjustedComposite: 84, craftScore: 88, craftTier: "Master" }),
      );
    const { result } = renderHook(() => useInsightsImport("octocat"));

    await act(() => result.current.importFile(file("report html")));

    expect(mocks.parseInsightsHtml).toHaveBeenCalledWith("report html");
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: 12 }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/recalculate", { method: "POST" });
    expect(result.current.toast).toEqual({
      message: "Craft 91, Expert translated",
      detail: "Impact score 84",
      type: "success",
    });
    expect(result.current.cooldownActive).toBe(true);
    expect(localStorage.getItem("chapa_insights_last_submitted_octocat")).toBeTruthy();
  });

  it("uses recalculation values and preserves an unknown craft tier", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(true, {}))
      .mockResolvedValueOnce(
        response(true, { adjustedComposite: 70, craftScore: 61, craftTier: "Legend" }),
      );
    const { result } = renderHook(() => useInsightsImport("octocat"));

    await act(() => result.current.importFile(file()));

    expect(result.current.toast?.message).toBe("Craft 61, Legend");
  });

  it("reports a successful import when recalculation fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(true, {}))
      .mockResolvedValueOnce(response(false));
    const { result } = renderHook(() => useInsightsImport("octocat"));

    await act(() => result.current.importFile(file()));

    expect(result.current.toast).toEqual({
      message: "Insights imported",
      detail: "Scores will update later",
      type: "success",
    });
    expect(result.current.cooldownActive).toBe(true);
  });

  it.each([
    ["parser failure", () => mocks.parseInsightsHtml.mockImplementationOnce(() => { throw new Error("bad html"); })],
    ["upload rejection", () => vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"))],
    ["upload response failure", () => vi.mocked(fetch).mockResolvedValueOnce(response(false))],
  ])("surfaces %s and allows the toast to be dismissed", async (_name, arrange) => {
    arrange();
    const { result } = renderHook(() => useInsightsImport("octocat"));

    await act(() => result.current.importFile(file()));
    expect(result.current.toast).toEqual({
      message: "Import failed",
      detail: "Try again",
      type: "error",
    });
    expect(localStorage.getItem("chapa_insights_last_submitted_octocat")).toBeNull();

    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });
});

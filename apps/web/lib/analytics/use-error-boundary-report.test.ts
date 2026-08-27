// @vitest-environment jsdom
import { renderHook, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function loadHook() {
  const mod = await import("./use-error-boundary-report");
  return mod.useErrorBoundaryReport;
}

function makeError(message: string, opts?: { digest?: string; stack?: string }) {
  const error = new Error(message) as Error & { digest?: string };
  if (opts?.digest) error.digest = opts.digest;
  if (opts?.stack !== undefined) error.stack = opts.stack;
  return error;
}

describe("useErrorBoundaryReport", () => {
  it("posts client_error telemetry to /api/telemetry on mount", async () => {
    const useErrorBoundaryReport = await loadHook();
    const error = makeError("boom", { digest: "digest-1" });

    renderHook(() => useErrorBoundaryReport(error, "share-page-error"));

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      message: "boom",
      digest: "digest-1",
      source: "share-page-error",
    });
  });

  it("defaults category to route_error but allows an override (e.g. global-error)", async () => {
    const useErrorBoundaryReport = await loadHook();
    const defaultError = makeError("default category boom");
    renderHook(() => useErrorBoundaryReport(defaultError, "share-page-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const defaultBody = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(defaultBody.category).toBe("route_error");

    const overrideError = makeError("override category boom");
    renderHook(() =>
      useErrorBoundaryReport(overrideError, "global-error", "global_error"),
    );
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const overrideBody = JSON.parse(mockFetch.mock.calls[1]![1].body as string);
    expect(overrideBody.category).toBe("global_error");
  });

  it("fires only once when the same error identity re-renders repeatedly (loop safety)", async () => {
    const useErrorBoundaryReport = await loadHook();

    // Simulate a persistent render loop: reset() is called repeatedly, and the
    // boundary keeps re-throwing an equivalent error. Next.js creates a NEW
    // Error instance per throw, so identity must be derived from content
    // (message/stack/digest), not object reference.
    const { rerender } = renderHook(
      ({ error }) => useErrorBoundaryReport(error, "share-page-error"),
      { initialProps: { error: makeError("boom", { stack: "Error: boom\n  at Foo" }) } },
    );

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 5; i++) {
      rerender({ error: makeError("boom", { stack: "Error: boom\n  at Foo" }) });
    }

    // Give any (incorrect) additional fetches a chance to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports again for a genuinely different error identity", async () => {
    const useErrorBoundaryReport = await loadHook();

    const { rerender } = renderHook(
      ({ error }) => useErrorBoundaryReport(error, "share-page-error"),
      { initialProps: { error: makeError("boom one") } },
    );
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender({ error: makeError("boom two") });
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    const secondBody = JSON.parse(mockFetch.mock.calls[1]![1].body as string);
    expect(secondBody.message).toBe("boom two");
  });

  it("treats two errors sharing a digest as the same identity even if messages differ", async () => {
    const useErrorBoundaryReport = await loadHook();

    const { rerender } = renderHook(
      ({ error }) => useErrorBoundaryReport(error, "share-page-error"),
      { initialProps: { error: makeError("first message", { digest: "same-digest" }) } },
    );
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    rerender({ error: makeError("second message", { digest: "same-digest" }) });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("tracks identical error content independently per source", async () => {
    const useErrorBoundaryReport = await loadHook();
    const errorA = makeError("shared message");
    const errorB = makeError("shared message");

    renderHook(() => useErrorBoundaryReport(errorA, "share-page-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    renderHook(() => useErrorBoundaryReport(errorB, "admin-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("redacts home-directory usernames from the stack before sending", async () => {
    const useErrorBoundaryReport = await loadHook();
    const error = makeError("boom", {
      stack: "Error: boom\n    at Foo (/Users/juan/code/chapa/apps/web/app/page.tsx:1:1)",
    });

    renderHook(() => useErrorBoundaryReport(error, "share-page-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.stack).not.toContain("/Users/juan");
    expect(body.stack).toContain("[user]");
  });

  it("redacts query strings embedded in the stack before sending", async () => {
    const useErrorBoundaryReport = await loadHook();
    const error = makeError("boom", {
      stack: "Error: boom\n    at fetch (https://chapa.test/api/foo?token=SECRET123)",
    });

    renderHook(() => useErrorBoundaryReport(error, "share-page-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.stack).not.toContain("SECRET123");
  });

  it("truncates an overly long message and stack", async () => {
    const useErrorBoundaryReport = await loadHook();
    const error = makeError("x".repeat(2000), { stack: "y".repeat(5000) });

    renderHook(() => useErrorBoundaryReport(error, "share-page-error"));
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body.message.length).toBeLessThanOrEqual(500);
    expect(body.stack.length).toBeLessThanOrEqual(1000);
  });

  it("swallows fetch failures without throwing", async () => {
    const useErrorBoundaryReport = await loadHook();
    mockFetch.mockRejectedValue(new Error("network down"));
    const error = makeError("boom");

    expect(() => {
      renderHook(() => useErrorBoundaryReport(error, "share-page-error"));
    }).not.toThrow();

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });
});

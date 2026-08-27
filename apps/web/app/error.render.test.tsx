// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import ErrorPage from "./error";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ErrorPage render", () => {
  it("renders the error heading", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    // useTranslation falls back to English when LanguageProvider is absent
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    // English fallback text from errors.tryAgain key
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports the error to /api/telemetry with the root-error source", async () => {
    const reset = vi.fn();
    const error = new Error("root boundary boom") as Error & { digest?: string };
    render(<ErrorPage error={error} reset={reset} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "root-error",
      message: "root boundary boom",
    });
  });
});

// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import GlobalError from "./global-error";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GlobalError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  });

  it("posts client-error telemetry on mount", async () => {
    const error = Object.assign(new Error("render failed"), {
      digest: "digest-1",
    });

    render(<GlobalError error={error} reset={vi.fn()} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/telemetry",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("render failed"),
        }),
      );
    });

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "global_error",
      source: "global-error",
      digest: "digest-1",
    });
  });
});

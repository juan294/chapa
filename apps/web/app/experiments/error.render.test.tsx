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

describe("experiments ErrorPage render", () => {
  it("renders the error heading and home link", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
    const homeLink = screen.getByRole("link", { name: "Go home" });
    expect(homeLink.getAttribute("href")).toBe("/");
  });

  it("calls reset when try again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders with role=alert and terminal-red styling, never amber", () => {
    const reset = vi.fn();
    const { container } = render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the experiments-error source", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("experiments boundary boom")} reset={reset} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "experiments-error",
      message: "experiments boundary boom",
    });
  });
});

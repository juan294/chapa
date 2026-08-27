// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import StudioError from "./error";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

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

describe("studio error.tsx — render", () => {
  const makeError = () => new Error("test") as Error & { digest?: string };

  it("renders Spanish copy when the active locale is Spanish", () => {
    const noop = vi.fn();
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <StudioError error={makeError()} reset={noop} />
      </LanguageProvider>,
    );
    // Spanish dictionary: errors.general.* / common.tryAgain / common.goHome
    expect(screen.getByText("Algo salió mal")).toBeDefined();
    expect(
      screen.getByText("Se produjo un error inesperado. Por favor, inténtalo de nuevo."),
    ).toBeDefined();
    expect(screen.getByText("Intentar de nuevo")).toBeDefined();
    expect(screen.getByText("Volver al inicio")).toBeDefined();
  });

  it("renders English copy when the active locale is English", () => {
    const noop = vi.fn();
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <StudioError error={makeError()} reset={noop} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Something went wrong")).toBeDefined();
    expect(
      screen.getByText("An unexpected error occurred. Please try again."),
    ).toBeDefined();
    expect(screen.getByText("Try again")).toBeDefined();
    expect(screen.getByText("Go home")).toBeDefined();
  });

  it("falls back to the English dictionary without a LanguageProvider (no crash)", () => {
    const noop = vi.fn();
    render(<StudioError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset when the retry button is clicked", () => {
    const reset = vi.fn();
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <StudioError error={makeError()} reset={reset} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("the go-home link points to the root path", () => {
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <StudioError error={makeError()} reset={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Go home").closest("a")?.getAttribute("href")).toBe(
      "/",
    );
  });

  it("renders with role=alert and terminal-red styling, never amber/purple", () => {
    const { container } = render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <StudioError error={makeError()} reset={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(container.querySelector(".text-terminal-red")).not.toBeNull();
    expect(container.innerHTML).not.toContain("amber");
  });

  it("reports the error to /api/telemetry with the studio-error source", async () => {
    const error = new Error("studio boundary boom") as Error & { digest?: string };
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <StudioError error={error} reset={vi.fn()} />
      </LanguageProvider>,
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/telemetry");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "client_error",
      category: "route_error",
      source: "studio-error",
      message: "studio boundary boom",
    });
  });
});

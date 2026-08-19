// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import VerifyError from "./error";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

describe("verify error.tsx — render", () => {
  const makeError = () => new Error("test") as Error & { digest?: string };

  it("renders Spanish copy when the active locale is Spanish", () => {
    const noop = vi.fn();
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <VerifyError error={makeError()} reset={noop} />
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
        <VerifyError error={makeError()} reset={noop} />
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
    render(<VerifyError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset when the retry button is clicked", () => {
    const reset = vi.fn();
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <VerifyError error={makeError()} reset={reset} />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("the go-home link points to the root path", () => {
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <VerifyError error={makeError()} reset={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.getByText("Go home").closest("a")?.getAttribute("href")).toBe(
      "/",
    );
  });

  it("uses complement (teal) tokens, not amber, for verification-related error UI", () => {
    // Design system rule: verification-related UI must use text-complement /
    // bg-complement tokens, never amber/purple (docs/design-system.md).
    render(
      <LanguageProvider initialLocale="en" dictionary={en}>
        <VerifyError error={makeError()} reset={vi.fn()} />
      </LanguageProvider>,
    );
    const heading = screen.getByText("Something went wrong");
    const retryButton = screen.getByText("Try again");
    expect(heading.className).toContain("text-complement");
    expect(retryButton.className).toContain("text-complement");
    expect(retryButton.className).toContain("bg-complement/10");
    expect(heading.className).not.toContain("text-amber");
    expect(retryButton.className).not.toContain("bg-amber");
  });
});

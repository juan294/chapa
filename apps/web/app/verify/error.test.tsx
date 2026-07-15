import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "error.tsx"),
  "utf-8",
);

describe("verify error.tsx — error boundary (source)", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toContain('"use client"');
  });

  it("exports a default function", () => {
    expect(SOURCE).toContain("export default function");
  });

  it("uses useTranslation for i18n", () => {
    expect(SOURCE).toContain("useTranslation");
  });

  it("uses errors.general.title key for heading", () => {
    expect(SOURCE).toContain("errors.general.title");
  });

  it("uses errors.general.description key for body", () => {
    expect(SOURCE).toContain("errors.general.description");
  });

  it("uses common.tryAgain key for retry button", () => {
    expect(SOURCE).toContain("common.tryAgain");
  });

  it("uses common.goHome key for home link", () => {
    expect(SOURCE).toContain("common.goHome");
  });

  it("calls reset on retry button click", () => {
    expect(SOURCE).toContain("onClick={reset}");
  });

  it("links to the root path", () => {
    expect(SOURCE).toContain('href="/"');
  });

  it("uses complement (teal) tokens, not amber, for verification-related error UI", () => {
    // Design system rule: verification-related UI must use text-complement /
    // bg-complement tokens, never amber/purple (docs/design-system.md).
    expect(SOURCE).toContain("text-complement");
    expect(SOURCE).toContain("bg-complement");
    expect(SOURCE).not.toContain("text-amber");
    expect(SOURCE).not.toContain("bg-amber");
  });
});

// ---------------------------------------------------------------------------
// Render tests — confirm the boundary actually resolves translated copy at
// runtime rather than the old hardcoded English strings (#1022).
// ---------------------------------------------------------------------------
// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
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
  });

  it("falls back to the English dictionary without a LanguageProvider (no crash)", () => {
    const noop = vi.fn();
    render(<VerifyError error={makeError()} reset={noop} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });
});

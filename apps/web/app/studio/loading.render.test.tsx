// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { resolveTranslation } from "@/lib/i18n/resolve";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

const mocks = vi.hoisted(() => ({
  getServerLocale: vi.fn(),
  getServerT: vi.fn(),
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: mocks.getServerLocale,
  getServerT: mocks.getServerT,
}));

afterEach(cleanup);

// #1109 (UX-H3): the aria-label and sr-only text must come from the i18n
// dictionary, not a hardcoded English literal. `app/studio/page.tsx` is
// `force-dynamic` and resolves the real per-request locale via
// getServerLocale(); this loading.tsx mirrors that instead of assuming
// DEFAULT_LOCALE.
describe("StudioLoading render — i18n (#1109)", () => {
  beforeEach(() => {
    mocks.getServerLocale.mockReset();
    mocks.getServerT.mockReset();
  });

  it("resolves the real per-request locale via getServerLocale(), not a hardcoded default", async () => {
    mocks.getServerLocale.mockResolvedValue("en");
    mocks.getServerT.mockReturnValue((key: string) => resolveTranslation(key, en));

    const { default: StudioLoading } = await import("./loading");
    render(await StudioLoading());

    expect(mocks.getServerLocale).toHaveBeenCalled();
    expect(mocks.getServerT).toHaveBeenCalledWith("en");
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("renders the Spanish aria-label and sr-only text when getServerLocale() resolves 'es'", async () => {
    mocks.getServerLocale.mockResolvedValue("es");
    mocks.getServerT.mockReturnValue((key: string) => resolveTranslation(key, es));

    const { default: StudioLoading } = await import("./loading");
    render(await StudioLoading());

    expect(screen.getByRole("status", { name: "Cargando" })).toBeDefined();
    expect(screen.getByText("Cargando...")).toBeDefined();
  });
});

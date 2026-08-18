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

describe("coming-soon loading.tsx render", () => {
  beforeEach(() => {
    mocks.getServerLocale.mockReset();
    mocks.getServerT.mockReset();
  });

  it("resolves the real per-request locale via getServerLocale()", async () => {
    mocks.getServerLocale.mockResolvedValue("en");
    mocks.getServerT.mockReturnValue((key: string) => resolveTranslation(key, en));

    const { default: ComingSoonLoading } = await import("./loading");
    render(await ComingSoonLoading());

    expect(mocks.getServerLocale).toHaveBeenCalled();
    expect(mocks.getServerT).toHaveBeenCalledWith("en");
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Loading...");
  });

  it("renders the Spanish loading text when getServerLocale() resolves 'es'", async () => {
    mocks.getServerLocale.mockResolvedValue("es");
    mocks.getServerT.mockReturnValue((key: string) => resolveTranslation(key, es));

    const { default: ComingSoonLoading } = await import("./loading");
    render(await ComingSoonLoading());

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-label")).toBe("Cargando...");
  });

  it("renders a pulsing skeleton indicator", async () => {
    mocks.getServerLocale.mockResolvedValue("en");
    mocks.getServerT.mockReturnValue((key: string) => resolveTranslation(key, en));

    const { default: ComingSoonLoading } = await import("./loading");
    const { container } = render(await ComingSoonLoading());
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});

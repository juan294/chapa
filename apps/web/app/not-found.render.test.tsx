// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("@/lib/i18n/server", async () => {
  const { getServerT } = await import("@/lib/i18n/server");
  return {
    getServerLocale: vi.fn().mockResolvedValue("en"),
    getServerT,
  };
});

import NotFound from "./not-found";

describe("NotFound render", () => {
  it("renders 404 heading", async () => {
    render(await NotFound());
    expect(screen.getByText("404")).toBeDefined();
  });

  it("renders Page not found text (via i18n)", async () => {
    render(await NotFound());
    // English locale: "Page not found" from notFound.title
    expect(screen.getByText("Page not found")).toBeDefined();
  });

  it("has a Go home link", async () => {
    render(await NotFound());
    expect(screen.getByText("Go home")).toBeDefined();
  });
});

// #1218 — a 404 with a single way out dead-ends a visitor who arrived from a
// badge link and wanted the verify page.
describe("NotFound — v2 exits (#1218)", () => {
  it("offers both the home page and the verify page", async () => {
    render(await NotFound());
    const home = screen.getByRole("link", { name: /home|inicio/i });
    expect(home.getAttribute("href")).toBe("/");
    const verify = screen.getByRole("link", { name: /verify|verificar/i });
    expect(verify.getAttribute("href")).toBe("/verify");
  });

  it("gives both exits a 44px hit area", async () => {
    render(await NotFound());
    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-[44px]");
    }
  });
});

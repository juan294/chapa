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

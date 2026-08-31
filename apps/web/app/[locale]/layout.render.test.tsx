// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LocaleSegmentLayout, { generateStaticParams, dynamicParams } from "./layout";

afterEach(cleanup);

describe("generateStaticParams", () => {
  it("pre-renders both supported locales", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "es" }]);
  });
});

describe("dynamicParams", () => {
  it("rejects any locale outside the pre-rendered set", () => {
    expect(dynamicParams).toBe(false);
  });
});

describe("LocaleSegmentLayout", () => {
  it("renders its children unchanged", async () => {
    const jsx = await LocaleSegmentLayout({
      params: Promise.resolve({ locale: "en" }),
      children: <div data-testid="child">content</div>,
    });
    render(jsx);
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("content")).toBeDefined();
  });

  // #1165 (FE-M1) — hoisted here so all 9 migrated content pages emit an
  // early <html lang> marker in one edit, instead of each page needing
  // to render DocumentLocaleMarker itself (previously only the landing page
  // and the two /verify pages did, out of ~12 locale-aware routes).
  it("emits an early document-language marker for the route's own locale (en)", async () => {
    const jsx = await LocaleSegmentLayout({
      params: Promise.resolve({ locale: "en" }),
      children: <div data-testid="child">content</div>,
    });
    const { container } = render(jsx);
    const marker = container.querySelector(
      'template[data-chapa-document-locale="en"]',
    );
    expect(marker).not.toBeNull();
  });

  it("emits the Spanish document-language marker for the es route", async () => {
    const jsx = await LocaleSegmentLayout({
      params: Promise.resolve({ locale: "es" }),
      children: <div data-testid="child">content</div>,
    });
    const { container } = render(jsx);
    const marker = container.querySelector(
      'template[data-chapa-document-locale="es"]',
    );
    expect(marker).not.toBeNull();
  });
});

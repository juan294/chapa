// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => null,
}));

import { DynamicRouteShell } from "./DynamicRouteShell";

/** Depth-first walk of a returned element tree, without rendering it. */
function flatten(node: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ children?: unknown }>;
  return [element, ...flatten(element.props?.children)];
}

function shellTree(locale: "en" | "es") {
  return flatten(
    DynamicRouteShell({
      locale,
      navLinks: [{ label: "About", href: "/about" }],
      children: <div data-testid="page-body" />,
    }),
  );
}

function findByProp(tree: ReactElement[], prop: string) {
  return (
    tree.find(
      (el) => !!el.props && prop in (el.props as Record<string, unknown>),
    ) ?? null
  );
}

/**
 * #1194 / FE-S1 — the point of this component is that a dynamic route gets all
 * three corrections together. These assert it actually wires all three, so the
 * pages that use it only have to assert that they use it.
 */
describe("DynamicRouteShell", () => {
  it("emits the document-language correction for the resolved locale", () => {
    const script = shellTree("en").find(
      (el) => (el.props as { locale?: string })?.locale === "en",
    );
    expect(script).not.toBeNull();
  });

  it("provides the locale to the nested LanguageProvider", () => {
    const provider = findByProp(shellTree("en"), "initialLocale");
    expect(provider).not.toBeNull();
    expect(
      (provider!.props as { initialLocale: string }).initialLocale,
    ).toBe("en");
  });

  it("renders the session-aware server Navbar with the route's links", () => {
    const nav = findByProp(shellTree("en"), "navLinks");
    expect(nav).not.toBeNull();
    expect((nav!.props as { navLinks: unknown[] }).navLinks).toEqual([
      { label: "About", href: "/about" },
    ]);
  });

  it("renders the route's own children", () => {
    const body = shellTree("en").find(
      (el) => (el.props as { "data-testid"?: string })?.["data-testid"] === "page-body",
    );
    expect(body).toBeTruthy();
  });

  // #1071 — the root layout already serializes the default dictionary, so
  // re-sending it would double it in the RSC payload.
  it("reuses the root dictionary when the locale matches the default", () => {
    const provider = findByProp(shellTree(DEFAULT_LOCALE), "initialLocale");
    expect(
      (provider!.props as { dictionary?: unknown }).dictionary,
    ).toBeUndefined();
  });

  // #1201 — derived from `locale`, never hardcoded. A bare `en` was correct
  // only while the default locale was Spanish.
  it("supplies the other locale's dictionary on a mismatch", () => {
    const other = DEFAULT_LOCALE === "en" ? "es" : "en";
    const provider = findByProp(shellTree(other), "initialLocale");
    expect((provider!.props as { dictionary?: unknown }).dictionary).toBe(
      other === "es" ? es : en,
    );
  });
});

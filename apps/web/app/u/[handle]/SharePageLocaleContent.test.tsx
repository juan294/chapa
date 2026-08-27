// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let activeLocale: "en" | "es" = "en";
const translations = {
  en: {
    "sharePage.metadataTitle": "{handle} — Developer impact, decoded",
    "sharePage.srH1": "Developer impact of {handle}",
    "sharePage.badgeAriaLabel": "Chapa impact badge for {handle}",
  },
  es: {
    "sharePage.metadataTitle": "{handle} — Impacto de desarrollador, decodificado",
    "sharePage.srH1": "Impacto de desarrollador de {handle}",
    "sharePage.badgeAriaLabel": "Chapa de impacto de {handle}",
  },
} as const;

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: activeLocale,
    t: (key: keyof (typeof translations)["en"]) => translations[activeLocale][key],
  }),
}));

import { SharePageLocaleContent } from "./SharePageLocaleContent";

afterEach(() => {
  cleanup();
  activeLocale = "en";
});

describe("SharePageLocaleContent", () => {
  it("updates heading and badge label when the active locale changes", () => {
    const { rerender } = render(
      <SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Developer impact of octocat");
    // W1 — the h1 exists for WCAG heading-hierarchy compliance but is
    // visually hidden; the badge label above it is the visible heading.
    expect(heading.className).toContain("sr-only");
    expect(screen.getByText("Chapa impact badge for octocat").id).toBe("badge-label");

    activeLocale = "es";
    rerender(<SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Impacto de desarrollador de octocat",
    );
    expect(screen.getByText("Chapa de impacto de octocat").id).toBe("badge-label");
  });

  // #1184 (FE-L4): document.title is owned entirely by `generateMetadata`
  // (page.tsx) + the root layout's `"%s — Chapa"` title template. Both
  // resolve locale (including the `?lang=` deep-link override) via the same
  // `getServerLocale()` call used for the page body (#1066), so there is no
  // gap for a client effect to fill — and a duplicate, hardcoded "— Chapa"
  // suffix here would silently go stale if the layout's template ever
  // changed. This component must never touch document.title.
  it("never sets document.title — that stays owned by generateMetadata + the layout title template", () => {
    const sentinelTitle = "@octocat — Developer impact, decoded — Chapa";
    document.title = sentinelTitle;

    const { rerender } = render(
      <SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />,
    );
    expect(document.title).toBe(sentinelTitle);

    activeLocale = "es";
    rerender(<SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />);
    expect(document.title).toBe(sentinelTitle);
  });
});

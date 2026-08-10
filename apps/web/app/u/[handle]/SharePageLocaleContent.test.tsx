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
  it("updates title, heading, and badge label when the active locale changes", () => {
    const { rerender } = render(
      <SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />,
    );

    expect(document.title).toBe("@octocat — Developer impact, decoded — Chapa");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Developer impact of octocat",
    );
    expect(screen.getByText("Chapa impact badge for octocat").id).toBe("badge-label");

    activeLocale = "es";
    rerender(<SharePageLocaleContent handle="octocat" badgeLabelId="badge-label" />);

    expect(document.title).toBe("@octocat — Impacto de desarrollador, decodificado — Chapa");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Impacto de desarrollador de octocat",
    );
    expect(screen.getByText("Chapa de impacto de octocat").id).toBe("badge-label");
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("lang=es"),
}));

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => <nav>Navbar</nav>,
}));

vi.mock("@/lib/i18n", () => ({
  LocaleSync: ({ queryLang }: { queryLang?: string | null }) => (
    <span data-testid="locale-sync" data-query-lang={queryLang} />
  ),
  useTranslation: () => ({
    t: (key: string) =>
      key === "verify.title" ? "Verificar una Chapa" : key,
  }),
}));

vi.mock("./VerifyForm", () => ({ VerifyForm: () => <form /> }));

import { VerifyInputPageClient } from "./VerifyInputPageClient";

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("VerifyInputPageClient", () => {
  it("applies the pinned query locale and synchronizes the document title", () => {
    render(<VerifyInputPageClient />);

    expect(screen.getByTestId("locale-sync").getAttribute("data-query-lang")).toBe(
      "es",
    );
    expect(document.title).toBe("Verificar una Chapa — Chapa");
  });
});

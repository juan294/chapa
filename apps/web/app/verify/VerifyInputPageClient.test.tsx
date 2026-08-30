// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("lang=es"),
}));

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: ({
    navLinks,
    translationKey,
  }: {
    navLinks?: Array<{ label: string; href: string }>;
    translationKey?: string;
  }) => (
    <nav data-testid="navbar" data-translation-key={translationKey}>
      Navbar
      {navLinks?.map((l) => (
        <a key={l.href} href={l.href} data-testid={`navbar-link-${l.href}`}>
          {l.label}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock("@/components/SiteFooter", () => ({
  SiteFooter: ({ t }: { t: (key: string) => unknown }) => (
    <footer data-testid="site-footer">{t("landing.footer.privacy") as string}</footer>
  ),
}));

const NAV_INNER_LINKS = [
  { label: "Acerca de", href: "/about" },
  { label: "Puntuación", href: "/about/scoring" },
  { label: "Verificar", href: "/verify" },
];

vi.mock("@/lib/i18n", () => ({
  LocaleSync: ({ queryLang }: { queryLang?: string | null }) => (
    <span data-testid="locale-sync" data-query-lang={queryLang} />
  ),
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "verify.title") return "Verificar una Chapa";
      if (key === "nav.innerLinks") return NAV_INNER_LINKS;
      if (key === "landing.footer.privacy") return "Privacidad";
      if (key === "verify.awaitingHash") return "awaiting hash";
      if (key === "verify.awaitingHashBody")
        return "Every badge carries an HMAC-SHA256 seal.";
      if (key === "about.verification.limitNotTamperProofHeading")
        return "Not tamper-proof at the SVG level";
      if (key === "about.verification.limitNotTamperProofSuffix")
        return " — anyone can edit an SVG file.";
      return key;
    },
  }),
}));

vi.mock("./VerifyForm", () => ({ VerifyForm: () => <form /> }));

import { VerifyInputPageClient } from "./VerifyInputPageClient";

afterEach(() => {
  cleanup();
});

describe("VerifyInputPageClient", () => {
  it("applies the pinned query locale", () => {
    render(<VerifyInputPageClient />);

    expect(screen.getByTestId("locale-sync").getAttribute("data-query-lang")).toBe(
      "es",
    );
  });

  // #1167 (UX-B1, launch blocker) — /verify had no footer at all, so a
  // visitor landing here (e.g. from a badge's verification link) had no way
  // to reach Privacy or Terms.
  it("renders SiteFooter", () => {
    render(<VerifyInputPageClient />);
    expect(screen.getByTestId("site-footer").textContent).toBe("Privacidad");
  });

  // #1167 (UX-B1) — this page must get real-route nav links (via
  // NavbarClient's `translationKey` prop), not the landing page's
  // meaningless-off-page hash anchors.
  it("gives NavbarClient real-route inner nav links via translationKey", () => {
    render(<VerifyInputPageClient />);
    expect(screen.getByTestId("navbar").getAttribute("data-translation-key")).toBe(
      "nav.innerLinks",
    );
    expect(screen.getByTestId("navbar-link-/about").textContent).toBe("Acerca de");
    expect(screen.getByTestId("navbar-link-/about/scoring").textContent).toBe(
      "Puntuación",
    );
    expect(screen.getByTestId("navbar-link-/verify").textContent).toBe("Verificar");
  });
});

// #1218 — the verify page opened straight into a bare input with nothing under
// it, and the honest limitation note lived only in the explainer article.
describe("VerifyInputPageClient — v2 states (#1218)", () => {
  it("opens with the terminal marker rather than a bare $ prompt", () => {
    const { container } = render(<VerifyInputPageClient />);
    expect(container.textContent).toContain("% chapa verify");
  });

  it("names the idle state and explains what the hash is", () => {
    const { container } = render(<VerifyInputPageClient />);
    expect(container.textContent).toContain("awaiting hash");
    expect(container.textContent).toContain("HMAC-SHA256");
  });

  it("keeps the tamper-proofing limitation on the page", () => {
    const { container } = render(<VerifyInputPageClient />);
    expect(container.textContent).toContain("Not tamper-proof at the SVG level");
  });
});

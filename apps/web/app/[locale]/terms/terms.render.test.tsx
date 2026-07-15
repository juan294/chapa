// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));
vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => <nav data-testid="navbar" />,
}));
vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => null,
}));
vi.mock("@/lib/i18n/server", () => ({
  getServerT: vi.fn().mockReturnValue((key: string) => {
    const dict: Record<string, unknown> = {
      "legal.terms.h1Before": "Terms of ",
      "legal.terms.h1Highlight": "Service",
      "legal.terms.lastUpdated": "Last updated: February 2026",
      "legal.terms.sections": [
        {
          heading: "1. Acceptance of Terms",
          body: "By accessing or using Chapa...",
        },
        {
          heading: "7. Contact",
          body: "For questions about these terms, contact us at ",
        },
      ],
      "legal.terms.contactEmail": "support@chapa.thecreativetoken.com",
      "legal.terms.metadataTitle": "Terms of Service",
      "legal.terms.metadataDescription":
        "Terms of Service for Chapa. Understand the rules and guidelines for using the developer impact badge platform.",
      "legal.terms.metadataOgTitle": "Terms of Service — Chapa",
    };
    return (dict[key] ?? key) as unknown as string;
  }),
}));

import TermsPage from "./page";
import { getServerT } from "@/lib/i18n/server";

afterEach(cleanup);

describe("TermsPage", () => {
  it("renders navbar", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders h1 highlight in English", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("Service")).toBeDefined();
  });

  it("renders h1 contains Terms text", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Terms"
    );
  });

  it("renders last-updated note", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("Last updated: February 2026")).toBeDefined();
  });

  it("renders section heading", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("1. Acceptance of Terms")).toBeDefined();
  });

  it("renders contact email link on last section", async () => {
    render(await TermsPage({ params: Promise.resolve({ locale: "en" }) }));
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "mailto:support@chapa.thecreativetoken.com"
    );
  });

  it("renders with different getServerT mock (locale swap simulation)", async () => {
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      const dict: Record<string, unknown> = {
        "legal.terms.h1Before": "Términos del ",
        "legal.terms.h1Highlight": "Servicio",
        "legal.terms.lastUpdated": "Última actualización: febrero de 2026",
        "legal.terms.sections": [
          {
            heading: "1. Aceptación de los términos",
            body: "Al acceder o utilizar Chapa...",
          },
          {
            heading: "7. Contacto",
            body: "Para consultas sobre estos términos, contáctenos en ",
          },
        ],
        "legal.terms.contactEmail": "support@chapa.thecreativetoken.com",
        "legal.terms.metadataTitle": "Términos del Servicio",
        "legal.terms.metadataDescription": "...",
        "legal.terms.metadataOgTitle": "Términos del Servicio — Chapa",
      };
      return (dict[key] ?? key) as unknown as string;
    });

    render(
      await TermsPage({ params: Promise.resolve({ locale: "es" }) })
    );
    expect(screen.getByText("Servicio")).toBeDefined();
    expect(
      screen.getByText("Última actualización: febrero de 2026")
    ).toBeDefined();
    expect(
      screen.getByText("1. Aceptación de los términos")
    ).toBeDefined();
  });
});

describe("TermsPage generateMetadata", () => {
  it("returns metadata with title and description", async () => {
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      const dict: Record<string, unknown> = {
        "legal.terms.metadataTitle": "Terms of Service",
        "legal.terms.metadataDescription":
          "Terms of Service for Chapa. Understand the rules and guidelines for using the developer impact badge platform.",
        "legal.terms.metadataOgTitle": "Terms of Service — Chapa",
      };
      return (dict[key] ?? key) as unknown as string;
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(metadata.title).toBe("Terms of Service");
    expect(metadata.description).toContain("Terms of Service for Chapa");
  });
});

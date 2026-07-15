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
      "legal.privacy.h1Before": "Privacy ",
      "legal.privacy.h1Highlight": "Policy",
      "legal.privacy.lastUpdated": "Last updated: February 2026",
      "legal.privacy.sections": [
        {
          heading: "1. Information We Collect",
          body: "When you sign in with GitHub, we receive...",
        },
        {
          heading: "2. How We Use Your Information",
          body: "We use your development activity data solely...",
        },
        {
          heading: "6. Contact",
          body: "For privacy-related inquiries, contact us at ",
        },
      ],
      "legal.privacy.contactEmail": "support@chapa.thecreativetoken.com",
      "legal.privacy.metadataTitle": "Privacy Policy",
      "legal.privacy.metadataDescription":
        "Privacy Policy for Chapa. Learn how we handle your developer data, session storage, and analytics.",
      "legal.privacy.metadataOgTitle": "Privacy Policy — Chapa",
    };
    return (dict[key] ?? key) as unknown as string;
  }),
}));

import PrivacyPage from "./page";
import { getServerT } from "@/lib/i18n/server";

afterEach(cleanup);

describe("PrivacyPage", () => {
  it("renders navbar", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders h1 highlight", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("Policy")).toBeDefined();
  });

  it("renders h1 before text", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Privacy"
    );
  });

  it("renders last-updated note", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(
      screen.getByText("Last updated: February 2026")
    ).toBeDefined();
  });

  it("renders section heading", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("1. Information We Collect")).toBeDefined();
  });

  it("renders contact email link on last section", async () => {
    render(await PrivacyPage({ params: Promise.resolve({ locale: "en" }) }));
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "mailto:support@chapa.thecreativetoken.com"
    );
  });

  it("renders with different getServerT mock (locale swap simulation)", async () => {
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      const dict: Record<string, unknown> = {
        "legal.privacy.h1Before": "Política de ",
        "legal.privacy.h1Highlight": "Privacidad",
        "legal.privacy.lastUpdated": "Última actualización: febrero de 2026",
        "legal.privacy.sections": [
          {
            heading: "1. Información que recopilamos",
            body: "Al iniciar sesión con GitHub...",
          },
          {
            heading: "6. Contacto",
            body: "Para consultas relacionadas con la privacidad, contáctenos en ",
          },
        ],
        "legal.privacy.contactEmail": "support@chapa.thecreativetoken.com",
        "legal.privacy.metadataTitle": "Política de Privacidad",
        "legal.privacy.metadataDescription": "...",
        "legal.privacy.metadataOgTitle": "Política de Privacidad — Chapa",
      };
      return (dict[key] ?? key) as unknown as string;
    });

    render(
      await PrivacyPage({ params: Promise.resolve({ locale: "es" }) })
    );
    expect(screen.getByText("Privacidad")).toBeDefined();
    expect(
      screen.getByText("Última actualización: febrero de 2026")
    ).toBeDefined();
    expect(
      screen.getByText("1. Información que recopilamos")
    ).toBeDefined();
  });
});

describe("PrivacyPage generateMetadata", () => {
  it("returns metadata with title and description", async () => {
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      const dict: Record<string, unknown> = {
        "legal.privacy.metadataTitle": "Privacy Policy",
        "legal.privacy.metadataDescription":
          "Privacy Policy for Chapa. Learn how we handle your developer data, session storage, and analytics.",
        "legal.privacy.metadataOgTitle": "Privacy Policy — Chapa",
      };
      return (dict[key] ?? key) as unknown as string;
    });

    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(metadata.title).toBe("Privacy Policy");
    expect(metadata.description).toContain("Privacy Policy for Chapa");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// #1335 — v7.2 is the one scoring policy; the selector page.tsx used to
// read is retired, so this suite no longer toggles a "legacy" render path.
// Real dictionaries drive every assertion (there is only one branch left to
// prove: the current observed methodology, in both locales).

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/NavbarClient", () => ({
  NavbarClient: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => <div data-testid="command-bar" />,
}));

vi.mock("@/components/LiteYouTubeEmbed", () => ({
  LiteYouTubeEmbed: ({ title }: { title: string }) => (
    <div data-testid="youtube-embed">{title}</div>
  ),
}));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// #1023 (FE-H1) — ScoringMethodologyContent no longer reads translation via
// the client useTranslation() context; it receives `t` (getServerT(locale))
// as a prop, with `locale` sourced from the route's [locale] segment param.

describe("ScoringMethodologyPage render", () => {
  it("renders the navbar", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders the command bar", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("command-bar")).toBeDefined();
  });

  it("does not render the YouTube explainer embed (observed methodology has no video section)", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.queryByTestId("youtube-embed")).toBeNull();
  });
});

describe("ScoringMethodologyPage generateMetadata", () => {
  it("returns metadata with title, openGraph and twitter", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toBeTruthy();
    expect(meta.openGraph).toBeDefined();
    expect(meta.twitter).toBeDefined();
  });
});

describe("current observed methodology", () => {
  it.each(["en", "es"] as const)("renders current policy arithmetic and report states in %s", async (locale) => {
    const { default: Page } = await import("./page");
    const { container } = render(await Page({ params: Promise.resolve({ locale }) }));
    const text = container.textContent ?? "";
    expect(text).toContain("v7.2");
    expect(text).toContain("N(x, c) = ln(1 + min(x, c)) / ln(1 + c)");
    expect(text).toContain("0.25 × D + 0.25 × Q + 0.25 × C + 0.25 × B");
    expect(text).toContain("100 × (4 + 0.7 × 2 + 0.3 × 1) / 10 = 57");
    expect(text).toContain("8/10");
    expect(text).toContain("69.99");
    expect(text).toContain("46");
    expect(text).not.toContain("N(framing, 8)");
    expect(text).not.toContain("Master");
    expect(container.querySelectorAll("h2[id]")).toHaveLength(11);
    const craft = document.getElementById("scoring-craft")?.parentElement;
    expect(craft?.textContent).toMatch(locale === "en" ? /failed.*zero/i : /fallidos.*cero/i);
    expect(text).toMatch(locale === "en" ? /no report.*insufficient/i : /sin informe.*insuficientes/i);
    expect(text).toMatch(locale === "en" ? /archetype.*absent/i : /arquetipo.*ausente/i);
  });

  it.each(["en", "es"] as const)("labels metadata with the current policy in %s", async (locale) => {
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.title).toContain("v7.2");
    expect(metadata.description).not.toMatch(/completion ranges|intervalos de/i);
  });

  it("indexes every section, linked to the heading's own anchor", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    const index = screen.getByRole("navigation", { name: "On this page" });
    const links = Array.from(index.querySelectorAll("a"));
    expect(links.length).toBeGreaterThanOrEqual(11);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("renders tables with signal caps data", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    const { container } = render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });
});

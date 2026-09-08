// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const selectedPolicy = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/lib/scoring-render-selection", () => ({ readScoringRenderSelection: vi.fn(async () => ({ enabled: selectedPolicy.enabled, machinePolicy: selectedPolicy.enabled ? "v7.2" : "v6", cacheable: true, capturedAt: 0 })) }));

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

vi.mock("@/lib/i18n/server", () => ({
  getServerT: vi.fn().mockReturnValue((key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, any> = {
      // #1222 — the index takes its heading as a prop from the server `t`,
      // so this mock has to carry the key rather than relying on the client
      // translation fallback the component used to reach for itself.
      "content.onThisPage": "On this page",
      "about.scoringObserved.archivedNotice": "Archived methodology: algorithm v7.1, receipt policy v7. This is not the current observed v7.2 policy.",
      "about.scoring.h1": "Scoring Methodology",
      "about.scoring.intro": "Full transparency on how Chapa decodes your developer impact.",
      "about.scoring.videoHeading": "Watch the explainer",
      "about.scoring.videoTitle": "How Chapa Scores Developer Impact",
      "about.scoring.videoReadingNote": "Prefer reading? The full methodology is detailed below.",
      "about.scoring.sectionPhilosophy": "What the number is",
      "about.scoring.philosophyBody1": "Chapa reports an observed engineering activity and practices index.",
      "about.scoring.philosophyBody2Prefix": "The four dimensions carry ",
      "about.scoring.philosophyBody2Highlight": "fixed and equal weights of 0.25",
      "about.scoring.philosophyBody2Suffix": ". There is no confidence multiplier.",
      "about.scoring.sectionWindow": "One window, one clock",
      "about.scoring.windowBody": "A reference time is captured once per scored revision.",
      "about.scoring.windowNote": "Every receipt carries that same window.",
      "about.scoring.sectionNormalization": "Normalization",
      "about.scoring.normalizationBody": "Every count is transformed by the same ",
      "about.scoring.normalizationHighlight": "logarithmic normalization",
      "about.scoring.normalizationBodySuffix": ", so volume past the cap counts for nothing:",
      "about.scoring.normalizationFormula": "N(x, c) = ln(1 + min(x, c)) / ln(1 + c)",
      "about.scoring.normalizationCurveNote": "The result is between 0 and 1.",
      "about.scoring.sectionCaps": "Caps",
      "about.scoring.capsBody": "A cap is the point beyond which more volume adds nothing.",
      "about.scoring.capsTableHeaders": ["Counted thing", "Cap", "What reaching the cap takes"],
      "about.scoring.capsTableRows": [["Delivery units", "120", "About two and a half a week"]],
      "about.scoring.sectionDimensions": "The four core dimensions",
      "about.scoring.dimensionsBody": "Each dimension is weighted at exactly 0.25.",
      "about.scoring.deliveryHeading": "Delivery — observed accepted-work cadence",
      "about.scoring.deliveryFormula": "D = 100 × N(deliveryUnits, 120)",
      "about.scoring.deliveryTableHeaders": ["Counts toward Delivery", "Earns nothing"],
      "about.scoring.deliveryTableRows": [["A distinct (project, UTC date) bucket", "Changed lines"]],
      "about.scoring.deliveryNote": "Counting buckets removes the reward for splitting work.",
      "about.scoring.qualityHeading": "Quality practices — evidence of practices performed",
      "about.scoring.qualityFormula": "Q = 25 × [ N(rationale, 12) + ... ]",
      "about.scoring.qualityIntro": "Four criteria of equal weight.",
      "about.scoring.qualityTableHeaders": ["Criterion", "What qualifies", "What does not"],
      "about.scoring.qualityTableRows": [["Rationale", "The specific problem", "A restated ticket title"]],
      "about.scoring.qualityNote": "There is no solo penalty and no collaborative bonus.",
      "about.scoring.consistencyHeading": "Consistency — observed annual cadence",
      "about.scoring.consistencyFormula": "C = 100 × N(activeIsoWeeks, 40)",
      "about.scoring.consistencyIntro": "An active ISO week has at least one attributable contribution.",
      "about.scoring.consistencyNote": "There is no weekend penalty and no burst penalty.",
      "about.scoring.breadthHeading": "Breadth — diversity of observed work",
      "about.scoring.breadthFormula": "B = 50 × N(eligibleProjects, 4) + 50 × N(eligibleCategories, 4)",
      "about.scoring.breadthIntro": "A project becomes eligible after work on at least 3 distinct dates.",
      "about.scoring.breadthNote": "Stars, forks and watchers carry zero weight here.",
      "about.scoring.sectionCraft": "Craft — engineering practice (optional, separate)",
      "about.scoring.craftIntro": "Craft is a separate, optional practice portfolio.",
      "about.scoring.craftFormula": "K = 25 × [ N(framing, 8) + ... ]",
      "about.scoring.craftHowToHeading": "How to submit a Craft portfolio",
      "about.scoring.craftHowToBody": "If you use Claude Code, running ",
      "about.scoring.craftHowToCode": "/insights",
      "about.scoring.craftHowToBodySuffix": " produces a report you can import.",
      "about.scoring.craftWhatHeading": "What Craft measures",
      "about.scoring.craftWhatIntro": "Craft has four criteria of equal weight.",
      "about.scoring.craftTableHeaders": ["Criterion", "What qualifies", "What does not"],
      "about.scoring.craftTableRows": [["Framing", "The problem and its constraints", "A restated ticket title"]],
      "about.scoring.craftFrictionNote1": "Tool name and token counts earn no Craft credit at all.",
      "about.scoring.craftArtificerNote": "No eligible portfolio reads as not observed, never as zero.",
      "about.scoring.sectionRanges": "Incomplete evidence widens a range; it never lowers a score",
      "about.scoring.rangesIntro1Prefix": "Each count carries a lower bound and an upper bound. This is an ",
      "about.scoring.rangesIntro1Highlight": "evidence-completion range",
      "about.scoring.rangesIntro1Suffix": ", not a statistical confidence interval.",
      "about.scoring.rangesBody2": "A missing source raises the upper bounds only.",
      "about.scoring.rangesTableHeaders": ["Situation", "What is published"],
      "about.scoring.rangesTableRows": [["Every source complete", "A point score, a tier, and an archetype"]],
      "about.scoring.rangesNote": "Refusing to label a straddling range is deliberate.",
      "about.scoring.sectionArchetypes": "Developer archetypes",
      "about.scoring.archetypesIntro": "Your archetype describes the shape of your dimension profile.",
      "about.scoring.archetypesTableHeaders": ["Archetype", "Rule", "What it means"],
      "about.scoring.archetypesTableRows": [["Emerging", "Average < 25", "Getting started"]],
      "about.scoring.archetypesTieBreaking": "Ties resolve in a fixed order.",
      "about.scoring.sectionComposite": "Composite score and tiers",
      "about.scoring.compositeIntro": "The core is the plain average of the four dimensions.",
      "about.scoring.compositeFormula1": "core = (Delivery + Quality practices + Consistency + Breadth) / 4",
      "about.scoring.compositeRoundingNote": "Tiers are classified from the unrounded core.",
      "about.scoring.tiersTableHeaders": ["Tier", "Core range", "Description"],
      "about.scoring.tiersTableRows": [
        ["Emerging", "0 to under 30", "Getting started, or a light activity period"],
        ["Solid", "30 to under 70", "Active contribution across the window"],
        ["High", "70 to under 85", "Strong evidence across multiple dimensions"],
        ["Elite", "85 and above", "Exceptional breadth and depth of recorded contribution"],
      ],
      "about.scoring.sectionReceipts": "Receipts you can replay",
      "about.scoring.receiptsIntro1Prefix": "Once you have opted in, every scored revision issues an ",
      "about.scoring.receiptsIntro1Highlight": "immutable public receipt",
      "about.scoring.receiptsIntro1Suffix": " you can replay offline.",
      "about.scoring.receiptsBody2": "A receipt excludes private paths and repository names.",
      "about.scoring.receiptsBody3": "Corrections create a new immutable revision.",
      "about.scoring.receiptsConsentNote": "Publishing a receipt is opt-in, from your settings.",
      "about.scoring.sectionExcludes": "What earns nothing, anywhere",
      "about.scoring.excludesIntro": "These are not oversights.",
      "about.scoring.excludeFollowers": "Followers, stars, forks and watchers",
      "about.scoring.excludeFollowersSuffix": " — other people's behavior",
      "about.scoring.excludeLOC": "Lines and files changed",
      "about.scoring.excludeLOCSuffix": " — volume of text is not volume of work",
      "about.scoring.excludeTooling": "Tool names, tokens, messages",
      "about.scoring.excludeToolingSuffix": " — using an AI tool earns nothing by itself",
      "about.scoring.excludeTenure": "Account age and tenure",
      "about.scoring.excludeTenureSuffix": " — identical evidence scores identically",
      "about.scoring.excludePrivate": "Private repository names",
      "about.scoring.excludePrivateSuffix": " — a receipt records counts and coverage",
      "about.scoring.ctaHeading": "Help us improve this",
      "about.scoring.ctaBody": "We believe scoring methodology should be a conversation, not a black box.",
      "about.scoring.ctaTwitter": "Reach out on Twitter (@juang294)",
      "about.scoring.ctaEmail": "Email support@chapa.thecreativetoken.com",
      "about.scoring.metadataTitle": "Scoring Methodology",
      "about.scoring.metadataDescription": "How Chapa decodes your developer impact.",
      "about.scoring.ogTitle": "Chapa Scoring Methodology",
      "about.scoring.ogDescription": "Full transparency.",
      "about.scoring.twitterTitle": "Chapa Scoring Methodology",
      "about.scoring.twitterDescription": "Full transparency.",
    };
    return map[key] ?? key;
  }),
}));

afterEach(() => { cleanup(); selectedPolicy.enabled = false; vi.restoreAllMocks(); });

// #1023 (FE-H1) — ScoringMethodologyContent no longer reads translation via
// the client useTranslation() context; it receives `t` (getServerT(locale))
// as a prop, with `locale` sourced from the route's [locale] segment param.

describe("ScoringMethodologyPage render", () => {
  it("renders the page heading", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("Scoring Methodology")).toBeDefined();
    expect(screen.getByText(/Archived methodology: algorithm v7.1/)).toBeDefined();
  });

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

  it("renders section headings", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    // #1218 — each heading now also appears in the sticky "on this page"
    // index, which reads its labels from the same dictionary keys, so match
    // on the heading role rather than on the text alone.
    for (const heading of [
      "What the number is",
      "One window, one clock",
      "Normalization",
      "Caps",
      "The four core dimensions",
      "Incomplete evidence widens a range; it never lowers a score",
      "Receipts you can replay",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeDefined();
    }
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

  it("renders dimension sub-headings", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    const { container } = render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    const h3s = container.querySelectorAll("h3");
    expect(h3s.length).toBeGreaterThan(0);
  });

  it("renders tables with signal caps data", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    const { container } = render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("renders the YouTube explainer embed", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByTestId("youtube-embed")).toBeDefined();
  });

  it("renders the CTA section", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByText("Help us improve this")).toBeDefined();
  });
});

describe("ScoringMethodologyPage generateMetadata", () => {
  it("returns metadata with title and openGraph", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toBeTruthy();
    expect(meta.openGraph).toBeDefined();
    expect(meta.twitter).toBeDefined();
  });

  it("returns metadata with a title", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toBeTruthy();
  });
});


describe("current observed methodology", () => {
  it.each(["en", "es"] as const)("renders current policy arithmetic and report states in %s", async (locale) => {
    selectedPolicy.enabled = true;
    const { getServerT } = await import("@/lib/i18n/server");
    const { en } = await import("@/lib/i18n/dictionaries/en");
    const { es } = await import("@/lib/i18n/dictionaries/es");
    const { resolveTranslation } = await import("@/lib/i18n/resolve");
    vi.mocked(getServerT).mockReturnValueOnce(((key: string) => resolveTranslation(key, locale === "en" ? en : es)) as ReturnType<typeof getServerT>);
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
    expect(screen.queryByTestId("youtube-embed")).toBeNull();
    expect(container.querySelectorAll("h2[id]")).toHaveLength(11);
    const craft = document.getElementById("scoring-craft")?.parentElement;
    expect(craft?.textContent).toMatch(locale === "en" ? /failed.*zero/i : /fallidos.*cero/i);
    expect(text).toMatch(locale === "en" ? /no report.*insufficient/i : /sin informe.*insuficientes/i);
    expect(text).toMatch(locale === "en" ? /archetype.*absent/i : /arquetipo.*ausente/i);
    vi.mocked(getServerT).mockReturnValueOnce(((key: string) => resolveTranslation(key, locale === "en" ? en : es)) as ReturnType<typeof getServerT>);
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    expect(metadata.title).toContain("v7.2");
    expect(metadata.description).not.toMatch(/completion ranges|intervalos de/i);
  });
});

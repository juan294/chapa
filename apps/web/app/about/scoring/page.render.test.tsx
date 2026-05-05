// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
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
  getServerLocale: vi.fn().mockResolvedValue("en"),
  getServerT: vi.fn().mockReturnValue((key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, any> = {
      "about.scoring.h1": "Scoring Methodology",
      "about.scoring.intro": "Full transparency on how Chapa decodes your developer impact.",
      "about.scoring.videoHeading": "Watch the explainer",
      "about.scoring.videoTitle": "How Chapa Scores Developer Impact",
      "about.scoring.videoReadingNote": "Prefer reading? The full methodology is detailed below.",
      "about.scoring.sectionPhilosophy": "Philosophy",
      "about.scoring.philosophyBody1": "AI-assisted development makes traditional volume metrics increasingly meaningless.",
      "about.scoring.philosophyBody2Prefix": "Chapa replaces that single number with a ",
      "about.scoring.philosophyBody2Highlight": "multi-dimensional impact breakdown",
      "about.scoring.philosophyBody2Suffix": ": four core dimension scores.",
      "about.scoring.sectionNormalization": "Normalization",
      "about.scoring.normalizationBody": "Most raw metrics are transformed using ",
      "about.scoring.normalizationHighlight": "logarithmic normalization",
      "about.scoring.normalizationBodySuffix": " to reward genuine contribution:",
      "about.scoring.normalizationFormula": "f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)",
      "about.scoring.normalizationCurveNote": "This produces a value between 0 and 1.",
      "about.scoring.sectionCaps": "Signal caps",
      "about.scoring.capsBody": "Each signal has a cap.",
      "about.scoring.capsTableHeaders": ["Signal", "Cap", "Rationale"],
      "about.scoring.capsTableRows": [["Commits", "300", "150 commits/year normalizes to ~81%"]],
      "about.scoring.sectionDimensions": "The core dimensions",
      "about.scoring.dimensionsBody": "Each dimension is scored 0-100 independently.",
      "about.scoring.deliveryHeading": "Delivery — shipping meaningful changes",
      "about.scoring.deliveryTableHeaders": ["Signal", "Weight", "Rationale"],
      "about.scoring.deliveryTableRows": [["PR Weight", "70%", "The strongest signal"]],
      "about.scoring.deliveryPrWeightNote1": "PR weight is not a simple count.",
      "about.scoring.deliveryPrWeightNote2": "Delivery also includes a ",
      "about.scoring.deliveryFlowHighlight": "flow efficiency modifier",
      "about.scoring.deliveryFlowSuffix": " (±5%) based on median PR lead time.",
      "about.scoring.qualityHeading": "Quality — engineering discipline",
      "about.scoring.qualityIntro": "Quality is measured differently depending on your profile type.",
      "about.scoring.collaborativeQualityHeading": "Collaborative Quality",
      "about.scoring.collaborativeQualityTableHeaders": ["Signal", "Weight", "Rationale"],
      "about.scoring.collaborativeQualityTableRows": [["Reviews Submitted", "60%", "The core signal"]],
      "about.scoring.soloQualityHeading": "Solo Quality",
      "about.scoring.soloQualityTableHeaders": ["Signal", "Weight", "Rationale"],
      "about.scoring.soloQualityTableRows": [["PR Description Rate", "40%", "Strongest solo signal"]],
      "about.scoring.soloQualityNote": "Solo developers are never penalized for working alone.",
      "about.scoring.consistencyHeading": "Consistency — reliable, sustained contributions",
      "about.scoring.consistencyTableHeaders": ["Signal", "Weight", "Rationale"],
      "about.scoring.consistencyTableRows": [["Active Days (sqrt curve)", "45%", "Rewards getting started"]],
      "about.scoring.consistencyNote1Prefix": "The active days signal uses a ",
      "about.scoring.consistencyNote1Highlight": "square root curve",
      "about.scoring.consistencyNote1Suffix": " instead of a linear ratio.",
      "about.scoring.breadthHeading": "Breadth — cross-project influence",
      "about.scoring.breadthTableHeaders": ["Signal", "Weight", "Rationale"],
      "about.scoring.breadthTableRows": [["Repos Contributed", "40%", "How many repos contributed"]],
      "about.scoring.breadthNote": "Breadth prioritizes signals you can directly control.",
      "about.scoring.sectionCraft": "Craft — AI tool mastery (optional)",
      "about.scoring.craftIntro": "Craft is an optional fifth dimension.",
      "about.scoring.craftHowToHeading": "How to unlock Craft",
      "about.scoring.craftHowToBody": "In Claude Code, run ",
      "about.scoring.craftHowToCode": "/insights",
      "about.scoring.craftHowToBodySuffix": " to generate your insights report.",
      "about.scoring.craftWhatHeading": "What Craft measures",
      "about.scoring.craftWhatIntro": "Craft is the average of three sub-dimensions:",
      "about.scoring.craftTableHeaders": ["Sub-dimension", "What it measures", "Key signals"],
      "about.scoring.craftTableRows": [["Proficiency", "Tool mastery", "Tool diversity"]],
      "about.scoring.craftFrictionNote1": "Friction events are excluded from scoring.",
      "about.scoring.sectionArchetypes": "Developer archetypes",
      "about.scoring.archetypesIntro": "Your archetype is derived from the shape of your dimension profile.",
      "about.scoring.archetypesTableHeaders": ["Archetype", "Rule", "What it means"],
      "about.scoring.archetypesTableRows": [["Emerging", "Average < 25", "Getting started"]],
      "about.scoring.archetypesTieBreaking": "Tie-breaking priority: Polymath > Quality Champion > Marathoner > Builder > Artificer.",
      "about.scoring.sectionComposite": "Composite score and tiers",
      "about.scoring.compositeIntro": "The composite score is the average of all active dimensions.",
      "about.scoring.compositeFormula1": "recencyWeighted = composite × recencyMultiplier",
      "about.scoring.compositeFormula2": "adjustedScore = recencyWeighted × (0.85 + 0.15 × confidence / 100)",
      "about.scoring.compositeRecencyNote": "The recency multiplier ranges from 0.98x to 1.06x.",
      "about.scoring.compositeConfidenceNote": "At full confidence (100), there is no confidence reduction.",
      "about.scoring.tiersTableHeaders": ["Tier", "Score Range", "Description"],
      "about.scoring.tiersTableRows": [
        ["Emerging", "0 – 29", "Getting started or light activity period"],
        ["Solid", "30 – 69", "Active hobbyists through consistent contributors"],
        ["High", "70 – 84", "Strong impact across multiple dimensions"],
        ["Elite", "85 – 100", "Exceptional breadth and depth of contribution"],
      ],
      "about.scoring.sectionConfidence": "Confidence system",
      "about.scoring.confidenceIntro1Prefix": "Confidence (50-100) measures ",
      "about.scoring.confidenceIntro1Highlight": "signal clarity",
      "about.scoring.confidenceIntro1Suffix": ", not morality.",
      "about.scoring.confidenceIntro2": "Confidence starts at 100 and can be reduced by detected patterns:",
      "about.scoring.confidenceTableHeaders": ["Pattern", "Penalty", "Trigger", "What it means"],
      "about.scoring.confidenceTableRows": [["Burst activity", "-15", "100+ contributions", "Extreme spikes"]],
      "about.scoring.confidenceFloor1Prefix": "The confidence floor is ",
      "about.scoring.confidenceFloor1Highlight": "50",
      "about.scoring.confidenceFloor1Suffix": ". No combination of penalties can push confidence below 50.",
      "about.scoring.confidenceMutuallyExclusivePrefix": "Review volume imbalance and low collaboration are ",
      "about.scoring.confidenceMutuallyExclusiveHighlight": "mutually exclusive",
      "about.scoring.confidenceMutuallyExclusiveSuffix": " — only one can apply at a time.",
      "about.scoring.sectionSmoothing": "Score smoothing",
      "about.scoring.smoothingIntro1Prefix": "Your displayed score uses an ",
      "about.scoring.smoothingIntro1Highlight": "exponential moving average (EMA)",
      "about.scoring.smoothingIntro1Suffix": " to prevent jarring day-to-day swings.",
      "about.scoring.smoothingFormula": "displayed = 0.15 × current + 0.85 × previous",
      "about.scoring.smoothingNote": "This means a sudden 10-point raw drop manifests as roughly -1.5 per day.",
      "about.scoring.sectionExcludes": "What we deliberately exclude",
      "about.scoring.excludesIntro": "Some signals are intentionally left out of scoring:",
      "about.scoring.excludeFollowers": "Followers",
      "about.scoring.excludeFollowersSuffix": " — a social metric with no correlation to engineering output",
      "about.scoring.excludeLOC": "Lines of code",
      "about.scoring.excludeLOCSuffix": " — easily gamed",
      "about.scoring.excludePrivate": "Private repo names",
      "about.scoring.excludePrivateSuffix": " — we track repo count, not identities.",
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

vi.mock("@/lib/i18n", () => ({
  LocaleSync: () => null,
}));

afterEach(cleanup);

describe("ScoringMethodologyPage render", () => {
  it("renders the page heading", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Scoring Methodology")).toBeDefined();
  });

  it("renders the navbar", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders the command bar", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("command-bar")).toBeDefined();
  });

  it("renders section headings", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Philosophy")).toBeDefined();
    expect(screen.getByText("Normalization")).toBeDefined();
    expect(screen.getByText("Signal caps")).toBeDefined();
    expect(screen.getByText("The core dimensions")).toBeDefined();
  });

  it("renders dimension sub-headings", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    const { container } = render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    const h3s = container.querySelectorAll("h3");
    expect(h3s.length).toBeGreaterThan(0);
  });

  it("renders tables with signal caps data", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    const { container } = render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("renders the YouTube explainer embed", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("youtube-embed")).toBeDefined();
  });

  it("renders the CTA section", async () => {
    const { default: ScoringMethodologyPage } = await import("./page");
    render(await ScoringMethodologyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Help us improve this")).toBeDefined();
  });
});

describe("ScoringMethodologyPage generateMetadata", () => {
  it("returns metadata with title and openGraph for the default locale", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(meta.title).toBeTruthy();
    expect(meta.openGraph).toBeDefined();
    expect(meta.twitter).toBeDefined();
  });

  it("returns metadata when lang param is provided", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    expect(meta.title).toBeTruthy();
  });
});

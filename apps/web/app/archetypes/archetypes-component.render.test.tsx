// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

// Mock heavy dependencies before importing page components
vi.mock("@/lib/render/BadgeSvg", () => ({
  renderBadgeSvg: vi.fn(() => "<svg data-testid='mock-badge'></svg>"),
}));

vi.mock("@/lib/render/archetypeDemoData", () => ({
  BUILDER_STATS: { handle: "builder" },
  BUILDER_IMPACT: { compositeScore: 80 },
  GUARDIAN_STATS: { handle: "guardian" },
  GUARDIAN_IMPACT: { compositeScore: 75 },
  MARATHONER_STATS: { handle: "marathoner" },
  MARATHONER_IMPACT: { compositeScore: 70 },
  POLYMATH_STATS: { handle: "polymath" },
  POLYMATH_IMPACT: { compositeScore: 65 },
  BALANCED_STATS: { handle: "balanced" },
  BALANCED_IMPACT: { compositeScore: 60 },
  EMERGING_STATS: { handle: "emerging" },
  EMERGING_IMPACT: { compositeScore: 30 },
  ARTIFICER_STATS: { handle: "artificer" },
  ARTIFICER_IMPACT: { compositeScore: 72 },
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: () => <div data-testid="command-bar-lazy" />,
}));

vi.mock("@/lib/i18n", () => ({
  LocaleSync: () => null,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn(async () => "en"),
  getServerT: vi.fn(() => (key: string) => {
    // Return minimal mock values for all keys used in ArchetypePage
    const mocks: Record<string, string | string[] | Array<{ tier: string; description: string }>> = {
      // builder
      "archetypes.builder.terminalCommand": "chapa archetype builder",
      "archetypes.builder.h1Before": "The ",
      "archetypes.builder.h1Highlight": "Builder",
      "archetypes.builder.dominantDimension": "Delivery",
      "archetypes.builder.badgeAriaLabel": "Example Chapa badge for The Builder archetype",
      "archetypes.builder.essay": ["Builder essay paragraph one.", "Builder essay paragraph two."],
      "archetypes.builder.sectionIdentifies": "How Chapa identifies a Builder",
      "archetypes.builder.keySignalsHeading": "Key signals",
      "archetypes.builder.keySignals": [
        { tier: "PRIMARY", description: "Merged pull requests." },
      ],
      "archetypes.builder.keySignalsSolo": "archetypes.builder.keySignalsSolo",
      "archetypes.builder.keySignalsSoloHeading": "archetypes.builder.keySignalsSoloHeading",
      "archetypes.builder.sectionPractice": "What a Builder looks like in practice",
      "archetypes.builder.sectionRadar": "The Builder's radar shape",
      "archetypes.builder.backLink": "Back to features",
      "archetypes.builder.methodologyLink": "Full scoring methodology",
      // guardian
      "archetypes.guardian.terminalCommand": "chapa archetype guardian",
      "archetypes.guardian.h1Before": "The ",
      "archetypes.guardian.h1Highlight": "Quality Champion",
      "archetypes.guardian.dominantDimension": "Quality",
      "archetypes.guardian.badgeAriaLabel": "Example Chapa badge for The Quality Champion archetype",
      "archetypes.guardian.essay": ["Guardian essay paragraph."],
      "archetypes.guardian.sectionIdentifies": "How Chapa identifies a Quality Champion",
      "archetypes.guardian.keySignalsHeading": "Key signals (collaborative)",
      "archetypes.guardian.keySignals": [{ tier: "PRIMARY", description: "Reviews." }],
      "archetypes.guardian.keySignalsSolo": [{ tier: "PRIMARY", description: "PR descriptions." }],
      "archetypes.guardian.keySignalsSoloHeading": "Key signals (solo)",
      "archetypes.guardian.sectionPractice": "What a Quality Champion looks like in practice",
      "archetypes.guardian.sectionRadar": "The Quality Champion's radar shape",
      "archetypes.guardian.backLink": "Back to features",
      "archetypes.guardian.methodologyLink": "Full scoring methodology",
      // marathoner
      "archetypes.marathoner.terminalCommand": "chapa archetype marathoner",
      "archetypes.marathoner.h1Before": "The ",
      "archetypes.marathoner.h1Highlight": "Marathoner",
      "archetypes.marathoner.dominantDimension": "Consistency",
      "archetypes.marathoner.badgeAriaLabel": "Example Chapa badge for The Marathoner archetype",
      "archetypes.marathoner.essay": ["Marathoner essay paragraph."],
      "archetypes.marathoner.sectionIdentifies": "How Chapa identifies a Marathoner",
      "archetypes.marathoner.keySignalsHeading": "Key signals",
      "archetypes.marathoner.keySignals": [{ tier: "PRIMARY", description: "Active days." }],
      "archetypes.marathoner.keySignalsSolo": "archetypes.marathoner.keySignalsSolo",
      "archetypes.marathoner.keySignalsSoloHeading": "archetypes.marathoner.keySignalsSoloHeading",
      "archetypes.marathoner.sectionPractice": "What a Marathoner looks like in practice",
      "archetypes.marathoner.sectionRadar": "The Marathoner's radar shape",
      "archetypes.marathoner.backLink": "Back to features",
      "archetypes.marathoner.methodologyLink": "Full scoring methodology",
      // polymath
      "archetypes.polymath.terminalCommand": "chapa archetype polymath",
      "archetypes.polymath.h1Before": "The ",
      "archetypes.polymath.h1Highlight": "Polymath",
      "archetypes.polymath.dominantDimension": "Breadth",
      "archetypes.polymath.badgeAriaLabel": "Example Chapa badge for The Polymath archetype",
      "archetypes.polymath.essay": ["Polymath essay paragraph."],
      "archetypes.polymath.sectionIdentifies": "How Chapa identifies a Polymath",
      "archetypes.polymath.keySignalsHeading": "Key signals",
      "archetypes.polymath.keySignals": [{ tier: "PRIMARY", description: "Repositories." }],
      "archetypes.polymath.keySignalsSolo": "archetypes.polymath.keySignalsSolo",
      "archetypes.polymath.keySignalsSoloHeading": "archetypes.polymath.keySignalsSoloHeading",
      "archetypes.polymath.sectionPractice": "What a Polymath looks like in practice",
      "archetypes.polymath.sectionRadar": "The Polymath's radar shape",
      "archetypes.polymath.backLink": "Back to features",
      "archetypes.polymath.methodologyLink": "Full scoring methodology",
      // artificer
      "archetypes.artificer.terminalCommand": "chapa archetype artificer",
      "archetypes.artificer.h1Before": "The ",
      "archetypes.artificer.h1Highlight": "Artificer",
      "archetypes.artificer.dominantDimension": "Craft",
      "archetypes.artificer.badgeAriaLabel": "Example Chapa badge for The Artificer archetype",
      "archetypes.artificer.essay": ["Artificer essay paragraph."],
      "archetypes.artificer.sectionIdentifies": "How Chapa identifies an Artificer",
      "archetypes.artificer.keySignalsHeading": "Key signals",
      "archetypes.artificer.keySignals": [{ tier: "PRIMARY", description: "AI tool sessions." }],
      "archetypes.artificer.keySignalsSolo": "archetypes.artificer.keySignalsSolo",
      "archetypes.artificer.keySignalsSoloHeading": "archetypes.artificer.keySignalsSoloHeading",
      "archetypes.artificer.sectionPractice": "What an Artificer looks like in practice",
      "archetypes.artificer.sectionRadar": "The Artificer's radar shape",
      "archetypes.artificer.backLink": "Back to features",
      "archetypes.artificer.methodologyLink": "Full scoring methodology",
      // balanced
      "archetypes.balanced.terminalCommand": "chapa archetype balanced",
      "archetypes.balanced.h1Before": "The ",
      "archetypes.balanced.h1Highlight": "Balanced",
      "archetypes.balanced.dominantDimension": "None",
      "archetypes.balanced.badgeAriaLabel": "Example Chapa badge for The Balanced archetype",
      "archetypes.balanced.essay": ["Balanced essay paragraph."],
      "archetypes.balanced.sectionIdentifies": "How Chapa identifies a Balanced developer",
      "archetypes.balanced.keySignalsHeading": "Key signals",
      "archetypes.balanced.keySignals": [{ tier: "REQUIREMENT", description: "All dimensions matched." }],
      "archetypes.balanced.keySignalsSolo": "archetypes.balanced.keySignalsSolo",
      "archetypes.balanced.keySignalsSoloHeading": "archetypes.balanced.keySignalsSoloHeading",
      "archetypes.balanced.sectionPractice": "What a Balanced developer looks like in practice",
      "archetypes.balanced.sectionRadar": "The Balanced radar shape",
      "archetypes.balanced.backLink": "Back to features",
      "archetypes.balanced.methodologyLink": "Full scoring methodology",
      // emerging
      "archetypes.emerging.terminalCommand": "chapa archetype emerging",
      "archetypes.emerging.h1Before": "The ",
      "archetypes.emerging.h1Highlight": "Emerging",
      "archetypes.emerging.dominantDimension": "None yet",
      "archetypes.emerging.badgeAriaLabel": "Example Chapa badge for The Emerging archetype",
      "archetypes.emerging.essay": ["Emerging essay paragraph."],
      "archetypes.emerging.sectionIdentifies": "How Chapa identifies an Emerging developer",
      "archetypes.emerging.keySignalsHeading": "Key signals",
      "archetypes.emerging.keySignals": [{ tier: "TRIGGER", description: "Activity below threshold." }],
      "archetypes.emerging.keySignalsSolo": "archetypes.emerging.keySignalsSolo",
      "archetypes.emerging.keySignalsSoloHeading": "archetypes.emerging.keySignalsSoloHeading",
      "archetypes.emerging.sectionPractice": "What an Emerging developer looks like in practice",
      "archetypes.emerging.sectionRadar": "The Emerging radar shape",
      "archetypes.emerging.backLink": "Back to features",
      "archetypes.emerging.methodologyLink": "Full scoring methodology",
    };
    return mocks[key] ?? key;
  }),
}));

afterEach(cleanup);

// Helper: resolve an async server component to JSX, then render it
async function renderServerComponent<T extends object>(
  Component: (props: T) => Promise<React.ReactElement>,
  props: T,
): Promise<void> {
  const jsx = await Component(props);
  render(jsx);
}

const mockSearchParams = Promise.resolve({ lang: "en" });

describe("Archetype pages — component render (i18n)", () => {
  it("renders BuilderPage with English heading", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "builder", searchParams: mockSearchParams });
    expect(screen.getByText("Builder")).toBeDefined();
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders GuardianPage with Quality Champion heading", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "guardian", searchParams: mockSearchParams });
    expect(screen.getByText("Quality Champion")).toBeDefined();
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders MarathonerPage with Marathoner heading", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "marathoner", searchParams: mockSearchParams });
    expect(screen.getByText("Marathoner")).toBeDefined();
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders PolymathPage", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "polymath", searchParams: mockSearchParams });
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders BalancedPage", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "balanced", searchParams: mockSearchParams });
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders EmergingPage", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "emerging", searchParams: mockSearchParams });
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders ArtificerPage", async () => {
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "artificer", searchParams: mockSearchParams });
    expect(screen.getByTestId("navbar")).toBeDefined();
  });
});

describe("Archetype pages — Spanish locale", () => {
  it("renders BuilderPage with Spanish locale via lang=es", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("es");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      const mocks: Record<string, string | string[] | Array<{ tier: string; description: string }>> = {
        "archetypes.builder.terminalCommand": "chapa archetype builder",
        "archetypes.builder.h1Before": "El ",
        "archetypes.builder.h1Highlight": "Builder",
        "archetypes.builder.dominantDimension": "Entrega",
        "archetypes.builder.badgeAriaLabel": "Ejemplo de Chapa para el arquetipo Builder",
        "archetypes.builder.essay": ["Parrafo uno del Builder.", "Parrafo dos del Builder."],
        "archetypes.builder.sectionIdentifies": "Como Chapa identifica a un Builder",
        "archetypes.builder.keySignalsHeading": "Senales clave",
        "archetypes.builder.keySignals": [{ tier: "PRIMARIA", description: "Pull requests fusionadas." }],
        "archetypes.builder.keySignalsSolo": "archetypes.builder.keySignalsSolo",
        "archetypes.builder.keySignalsSoloHeading": "archetypes.builder.keySignalsSoloHeading",
        "archetypes.builder.sectionPractice": "Como se ve un Builder en la practica",
        "archetypes.builder.sectionRadar": "La forma del radar del Builder",
        "archetypes.builder.backLink": "Volver a funciones",
        "archetypes.builder.methodologyLink": "Metodologia completa",
      };
      return mocks[key] ?? key;
    });
    const spSearchParams = Promise.resolve({ lang: "es" });
    const { ArchetypePage } = await import("./_components/ArchetypePage");
    await renderServerComponent(ArchetypePage, { archetypeKey: "builder", searchParams: spSearchParams });
    // The h1Highlight key is still "Builder" (brand name) in Spanish
    expect(screen.getByText("Builder")).toBeDefined();
  });

  it("renders MarathonerPage metadata in Spanish", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("es");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.marathoner.metadataTitle") return "El arquetipo Marathoner";
      if (key === "archetypes.marathoner.metadataDescription") return "Los Marathoner aparecen cada dia.";
      return key;
    });
    const { generateMetadata } = await import("./marathoner/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "es" }) });
    expect(meta.title).toBe("El arquetipo Marathoner");
    expect(meta.description).toBe("Los Marathoner aparecen cada dia.");
  });

  it("renders PolymathPage metadata in Spanish", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("es");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.polymath.metadataTitle") return "El arquetipo Polymath";
      if (key === "archetypes.polymath.metadataDescription") return "Los Polymath extienden su impacto.";
      return key;
    });
    const { generateMetadata } = await import("./polymath/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "es" }) });
    expect(meta.title).toBe("El arquetipo Polymath");
    expect(meta.description).toBe("Los Polymath extienden su impacto.");
  });
});

describe("generateMetadata — locale-specific titles", () => {
  it("BuilderPage returns English metadata by default", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("en");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.builder.metadataTitle") return "The Builder Archetype";
      if (key === "archetypes.builder.metadataDescription") return "Builders are the shipping engine.";
      return key;
    });
    const { generateMetadata } = await import("./builder/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(meta.title).toBe("The Builder Archetype");
    expect(meta.description).toBe("Builders are the shipping engine.");
  });

  it("GuardianPage returns Spanish metadata for lang=es", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("es");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.guardian.metadataTitle") return "El arquetipo Quality Champion";
      if (key === "archetypes.guardian.metadataDescription") return "Los Quality Champion lideran la disciplina.";
      return key;
    });
    const { generateMetadata } = await import("./guardian/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "es" }) });
    expect(meta.title).toBe("El arquetipo Quality Champion");
    expect(meta.description).toBe("Los Quality Champion lideran la disciplina.");
  });

  it("BalancedPage returns correct English metadata", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("en");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.balanced.metadataTitle") return "The Balanced Archetype";
      if (key === "archetypes.balanced.metadataDescription") return "Balanced developers score well across all four dimensions.";
      return key;
    });
    const { generateMetadata } = await import("./balanced/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(meta.title).toBe("The Balanced Archetype");
  });

  it("ArtificerPage returns correct English metadata", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("en");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.artificer.metadataTitle") return "The Artificer Archetype";
      if (key === "archetypes.artificer.metadataDescription") return "Artificers harness AI as a force multiplier.";
      return key;
    });
    const { generateMetadata } = await import("./artificer/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(meta.title).toBe("The Artificer Archetype");
    expect(meta.description).toBe("Artificers harness AI as a force multiplier.");
  });

  it("EmergingPage returns correct English metadata", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValueOnce("en");
    vi.mocked(getServerT).mockReturnValueOnce((key: string) => {
      if (key === "archetypes.emerging.metadataTitle") return "The Emerging Archetype";
      if (key === "archetypes.emerging.metadataDescription") return "Emerging developers are building momentum.";
      return key;
    });
    const { generateMetadata } = await import("./emerging/page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(meta.title).toBe("The Emerging Archetype");
    expect(meta.description).toBe("Emerging developers are building momentum.");
  });
});

describe("Archetype pages — default export wrappers", () => {
  const searchParams = Promise.resolve({});

  // Each page's default export is a thin wrapper that calls ArchetypePage with
  // the correct archetypeKey. We call the default export (exercising it for v8
  // coverage), then resolve the returned ArchetypePage element via renderServerComponent
  // so the DOM includes the mocked Navbar.

  it.each([
    ["BalancedPage", "balanced", () => import("./balanced/page")],
    ["BuilderPage", "builder", () => import("./builder/page")],
    ["GuardianPage", "guardian", () => import("./guardian/page")],
    ["MarathonerPage", "marathoner", () => import("./marathoner/page")],
    ["PolymathPage", "polymath", () => import("./polymath/page")],
    ["ArtificerPage", "artificer", () => import("./artificer/page")],
    ["EmergingPage", "emerging", () => import("./emerging/page")],
  ] as const)(
    "%s delegates to ArchetypePage with archetypeKey '%s'",
    async (_name, key, importer) => {
      const mod = await importer();
      const PageComponent = (mod as { default: (p: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactElement> }).default;
      // Call the page function — this exercises the default export for coverage
      const element = await PageComponent({ searchParams });
      // The returned element wraps ArchetypePage; call it to get renderable JSX
      const ArchetypePageFn = element.type as (p: object) => Promise<React.ReactElement>;
      const jsx = await ArchetypePageFn(element.props as object);
      render(jsx);
      expect(screen.getByTestId("navbar")).toBeDefined();
      // Verify the element delegates with the right archetypeKey
      expect((element.props as { archetypeKey: string }).archetypeKey).toBe(key);
    },
  );
});

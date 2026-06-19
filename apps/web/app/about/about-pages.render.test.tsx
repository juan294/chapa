// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

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
  LiteYouTubeEmbed: () => <div data-testid="youtube-embed" />,
}));

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn().mockResolvedValue("en"),
  getServerT: vi.fn().mockReturnValue((key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, any> = {
      "about.index.metadataTitle": "About",
      "about.index.metadataDescription": "Learn about Chapa.",
      "about.index.ogTitle": "About Chapa",
      "about.index.ogDescription": "About Chapa OG.",
      "about.index.twitterTitle": "About Chapa",
      "about.index.twitterDescription": "About Chapa twitter.",
      "about.index.h1": "About Chapa",
      "about.index.intro": ["First paragraph.", "Second paragraph."],
      "about.index.sectionDimensions": "Dimensions",
      "about.index.dimensionsBody": "Delivery — shipping meaningful changes.",
      "about.index.sectionArchetypes": "Developer archetypes",
      "about.index.archetypesBodyBefore": "Your dimension profile shape determines your archetype: ",
      "about.index.archetypesBodyAfter": ". The archetype is shown as the primary label.",
      "about.index.sectionPrivacy": "Privacy and fairness",
      "about.index.privacyBody": "Chapa only requests access to public data.",
      "about.index.scoringLinkLabel": "scoring methodology",
      "about.index.privacyBodyMiddle": " page. Learn more on our ",
      "about.index.verificationLinkLabel": "badge verification",
      "about.index.privacyBodyEnd": " page.",
      "about.index.sectionContact": "Contact",
      "about.index.contactBody": "Questions or feedback? Reach me at ",
      "about.index.contactEmail": "support@chapa.thecreativetoken.com",
      "about.index.contactBodyEnd": ".",
      "about.scoring.metadataTitle": "Scoring Methodology",
      "about.scoring.metadataDescription": "How Chapa decodes your developer impact.",
      "about.scoring.ogTitle": "Chapa Scoring Methodology",
      "about.scoring.ogDescription": "Full transparency.",
      "about.scoring.twitterTitle": "Chapa Scoring Methodology",
      "about.scoring.twitterDescription": "Full transparency.",
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
      "about.scoring.archetypesTieBreaking": "Tie-breaking priority: Polymath > Quality Champion.",
      "about.scoring.sectionComposite": "Composite score and tiers",
      "about.scoring.compositeIntro": "The composite score is the average of all active dimensions.",
      "about.scoring.compositeFormula1": "recencyWeighted = composite x recencyMultiplier",
      "about.scoring.compositeFormula2": "adjustedScore = recencyWeighted x (0.85 + 0.15 x confidence / 100)",
      "about.scoring.compositeRecencyNote": "The recency multiplier ranges from 0.98x to 1.06x.",
      "about.scoring.compositeConfidenceNote": "At full confidence, there is no confidence reduction.",
      "about.scoring.tiersTableHeaders": ["Tier", "Score Range", "Description"],
      "about.scoring.tiersTableRows": [
        ["Emerging", "0-29", "Getting started"],
        ["Solid", "30-69", "Active hobbyists"],
        ["High", "70-84", "Strong impact"],
        ["Elite", "85-100", "Exceptional"],
      ],
      "about.scoring.sectionConfidence": "Confidence system",
      "about.scoring.confidenceIntro1Prefix": "Confidence (50-100) measures ",
      "about.scoring.confidenceIntro1Highlight": "signal clarity",
      "about.scoring.confidenceIntro1Suffix": ", not morality.",
      "about.scoring.confidenceIntro2": "Confidence starts at 100.",
      "about.scoring.confidenceTableHeaders": ["Pattern", "Penalty", "Trigger", "What it means"],
      "about.scoring.confidenceTableRows": [["Burst activity", "-15", "100+ contributions", "Extreme spikes"]],
      "about.scoring.confidenceFloor1Prefix": "The confidence floor is ",
      "about.scoring.confidenceFloor1Highlight": "50",
      "about.scoring.confidenceFloor1Suffix": ". No combination can push it below 50.",
      "about.scoring.confidenceMutuallyExclusivePrefix": "Review volume imbalance and low collaboration are ",
      "about.scoring.confidenceMutuallyExclusiveHighlight": "mutually exclusive",
      "about.scoring.confidenceMutuallyExclusiveSuffix": " — only one can apply.",
      "about.scoring.sectionSmoothing": "Score smoothing",
      "about.scoring.smoothingIntro1Prefix": "Your displayed score uses an ",
      "about.scoring.smoothingIntro1Highlight": "exponential moving average (EMA)",
      "about.scoring.smoothingIntro1Suffix": " to prevent jarring swings.",
      "about.scoring.smoothingFormula": "displayed = 0.15 x current + 0.85 x previous",
      "about.scoring.smoothingNote": "This means a sudden 10-point raw drop manifests as -1.5 per day.",
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
      "about.verification.metadataTitle": "Badge Verification",
      "about.verification.metadataDescription": "How Chapa badges are verified.",
      "about.verification.ogTitle": "Chapa Badge Verification",
      "about.verification.ogDescription": "How the verification hash works.",
      "about.verification.twitterTitle": "Chapa Badge Verification",
      "about.verification.twitterDescription": "How the verification hash works.",
      "about.verification.h1": "Badge Verification",
      "about.verification.intro": "Every Chapa badge carries a verification hash.",
      "about.verification.sectionWhy": "Why verification exists",
      "about.verification.whyBody1": "Chapa badges are embeddable SVGs.",
      "about.verification.whyBody2Prefix": "Anyone can paste it into the ",
      "about.verification.verifyPageLink": "verification page",
      "about.verification.whyBody2Suffix": " to confirm the badge is authentic.",
      "about.verification.sectionHow": "How it works",
      "about.verification.howIntro": "The hash is generated using ",
      "about.verification.howHighlight": "HMAC-SHA256",
      "about.verification.howSuffix": ", a widely used message authentication code.",
      "about.verification.howStep1Heading": "Build a deterministic payload",
      "about.verification.howStep1Body": " — the badge data fields are concatenated.",
      "about.verification.howStep2Heading": "Sign the payload",
      "about.verification.howStep2Body": " — the payload is signed with a secret key.",
      "about.verification.howStep3Heading": "Truncate to 32 characters",
      "about.verification.howStep3Body": " — the first 32 hex characters are used.",
      "about.verification.howStorageNote": "When a badge is generated, the verification record is stored.",
      "about.verification.sectionWhat": "What data is signed",
      "about.verification.whatIntro": "The HMAC payload includes every meaningful field on the badge:",
      "about.verification.whatTableHeaders": ["Field", "Example", "Why included"],
      "about.verification.whatTableRows": [["Handle", "juan294", "Ties the badge to a developer"]],
      "about.verification.whatDeterministicNote": "Scores are rounded to integers before signing.",
      "about.verification.sectionGuarantees": "What it guarantees",
      "about.verification.guaranteeDataIntegrityHeading": "Data integrity",
      "about.verification.guaranteeDataIntegritySuffix": " — if any field has been altered, the hash won't match.",
      "about.verification.guaranteeAuthenticityHeading": "Authenticity",
      "about.verification.guaranteeAuthenticitySuffix": " — only the Chapa server can produce a valid hash.",
      "about.verification.guaranteeDateHeading": "Date binding",
      "about.verification.guaranteeDateSuffix": " — the date is part of the payload.",
      "about.verification.sectionLimits": "What it does not guarantee",
      "about.verification.limitsIntro": "Transparency means being honest about limitations:",
      "about.verification.limitNotBlockchainHeading": "Not a blockchain",
      "about.verification.limitNotBlockchainSuffix": " — records stored in a database with a 30-day TTL.",
      "about.verification.limitTrustHeading": "Trust in Chapa",
      "about.verification.limitTrustSuffix": " — the system proves the badge was generated by Chapa.",
      "about.verification.limitNotTamperProofHeading": "Not tamper-proof at the SVG level",
      "about.verification.limitNotTamperProofSuffix": " — anyone can edit an SVG file.",
      "about.verification.sectionHowTo": "How to verify a badge",
      "about.verification.howToStep1": "Find the 32-character hex code on the right edge.",
      "about.verification.howToStep2Prefix": "Go to the ",
      "about.verification.howToStep2Link": "verification page",
      "about.verification.howToStep2Suffix": " and enter the code.",
      "about.verification.howToStep3": "The result will show the original badge data.",
      "about.verification.howToApiPrefix": "You can also use the API directly: ",
      "about.verification.howToApiSuffix": " returns a JSON response.",
      "about.verification.howToRateLimit": "Rate-limited to 30 requests per minute per IP.",
      "about.verification.sectionDesign": "Design decisions",
      "about.verification.designTableHeaders": ["Decision", "Rationale"],
      "about.verification.designTableRows": [["HMAC-SHA256", "Industry standard."]],
      "about.verification.ctaHeading": "Try it yourself",
      "about.verification.ctaBody": "Every Chapa badge has a verification hash.",
      "about.verification.ctaButton": "Verify a Badge",
    };
    return map[key] ?? key;
  }),
}));

vi.mock("@/lib/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n")>();
  return {
    ...actual,
    LocaleSync: () => null,
  };
});

import AboutLoading from "./loading";
import AboutError from "./error";

afterEach(cleanup);

describe("AboutPage render (en)", () => {
  it("renders the about page with en heading", async () => {
    const { default: AboutPage } = await import("./page");
    render(await AboutPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(screen.getByText("About Chapa")).toBeDefined();
    expect(screen.getByText("Dimensions")).toBeDefined();
  });

  it("renders all section headings", async () => {
    const { default: AboutPage } = await import("./page");
    render(await AboutPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Developer archetypes")).toBeDefined();
    expect(screen.getByText("Privacy and fairness")).toBeDefined();
    expect(screen.getByText("Contact")).toBeDefined();
  });
});

describe("AboutPage render (es)", () => {
  it("renders the about page with es heading", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("es");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {
        "about.index.h1": "Acerca de Chapa",
        "about.index.intro": ["Primer párrafo.", "Segundo párrafo."],
        "about.index.sectionDimensions": "Dimensiones",
        "about.index.dimensionsBody": "Entrega — enviar cambios significativos.",
        "about.index.sectionArchetypes": "Arquetipos de desarrollador",
        "about.index.archetypesBodyBefore": "La forma de tu perfil determina tu arquetipo: ",
        "about.index.archetypesBodyAfter": ". El arquetipo se muestra como etiqueta principal.",
        "about.index.sectionPrivacy": "Privacidad e imparcialidad",
        "about.index.privacyBody": "Chapa solo solicita acceso a datos públicos.",
        "about.index.scoringLinkLabel": "metodología de puntuación",
        "about.index.privacyBodyMiddle": " Aprende más en nuestra ",
        "about.index.verificationLinkLabel": "verificación de Chapa",
        "about.index.privacyBodyEnd": ".",
        "about.index.sectionContact": "Contacto",
        "about.index.contactBody": "¿Preguntas? Escríbeme a ",
        "about.index.contactEmail": "support@chapa.thecreativetoken.com",
        "about.index.contactBodyEnd": ".",
        "about.index.metadataTitle": "Acerca de",
        "about.index.metadataDescription": "Aprende sobre Chapa.",
        "about.index.ogTitle": "Acerca de Chapa",
        "about.index.ogDescription": "Acerca de Chapa OG.",
        "about.index.twitterTitle": "Acerca de Chapa",
        "about.index.twitterDescription": "Acerca de Chapa twitter.",
      };
      return map[key] ?? key;
    });
    const { default: AboutPage } = await import("./page");
    render(await AboutPage({ searchParams: Promise.resolve({ lang: "es" }) }));
    expect(screen.getByText("Acerca de Chapa")).toBeDefined();
    expect(screen.getByText("Dimensiones")).toBeDefined();
  });
});

describe("generateMetadata (about/index)", () => {
  it("returns locale-specific title for es", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("es");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      if (key === "about.index.metadataTitle") return "Acerca de";
      if (key === "about.index.metadataDescription") return "Aprende sobre Chapa.";
      if (key === "about.index.ogTitle") return "Acerca de Chapa";
      if (key === "about.index.ogDescription") return "OG desc es";
      if (key === "about.index.twitterTitle") return "Acerca de Chapa";
      if (key === "about.index.twitterDescription") return "Twitter desc es";
      return key;
    });
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "es" }) });
    expect(meta.title).toBe("Acerca de");
  });
});

describe("ScoringPage render (en)", () => {
  it("renders the scoring page heading in en", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("en");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      // Return arrays for table headers/rows, strings for everything else
      if (key.endsWith("TableHeaders")) return ["Col1", "Col2", "Col3"];
      if (key.endsWith("TableRows")) return [["Cell1", "Cell2", "Cell3"]];
      const strMap: Record<string, string> = {
        "about.scoring.h1": "Scoring Methodology",
        "about.scoring.sectionPhilosophy": "Philosophy",
        "about.scoring.sectionNormalization": "Normalization",
        "about.scoring.sectionCaps": "Signal caps",
        "about.scoring.sectionDimensions": "The core dimensions",
        "about.scoring.ctaHeading": "Help us improve this",
      };
      return strMap[key] ?? (key.split('.').pop() ?? key);
    });
    const { default: ScoringPage } = await import("./scoring/page");
    render(await ScoringPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(screen.getByText("Scoring Methodology")).toBeDefined();
  });
});

describe("ScoringPage render (es)", () => {
  it("renders the scoring page heading in es", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("es");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {
        "about.scoring.h1": "Metodología de puntuación",
        "about.scoring.sectionPhilosophy": "Filosofía",
        "about.scoring.sectionNormalization": "Normalización",
        "about.scoring.sectionCaps": "Límites de señal",
        "about.scoring.sectionDimensions": "Las dimensiones base",
        "about.scoring.capsTableHeaders": ["Señal", "Límite", "Justificación"],
        "about.scoring.capsTableRows": [["Commits", "300", "150 commits/año"]],
        "about.scoring.deliveryTableHeaders": ["Señal", "Peso", "Justificación"],
        "about.scoring.deliveryTableRows": [["Peso de PR", "70%", "La señal más fuerte"]],
        "about.scoring.collaborativeQualityTableHeaders": ["Señal", "Peso", "Justificación"],
        "about.scoring.collaborativeQualityTableRows": [["Revisiones enviadas", "60%", "La señal principal"]],
        "about.scoring.soloQualityTableHeaders": ["Señal", "Peso", "Justificación"],
        "about.scoring.soloQualityTableRows": [["Tasa de descripción de PR", "40%", "La señal más fuerte"]],
        "about.scoring.consistencyTableHeaders": ["Señal", "Peso", "Justificación"],
        "about.scoring.consistencyTableRows": [["Días activos (curva sqrt)", "45%", "Recompensa el inicio"]],
        "about.scoring.breadthTableHeaders": ["Señal", "Peso", "Justificación"],
        "about.scoring.breadthTableRows": [["Repos contribuidos", "40%", "Cuántos repos"]],
        "about.scoring.craftTableHeaders": ["Subdimensión", "Qué mide", "Señales clave"],
        "about.scoring.craftTableRows": [["Competencia", "Dominio de herramientas", "Diversidad"]],
        "about.scoring.archetypesTableHeaders": ["Arquetipo", "Regla", "Qué significa"],
        "about.scoring.archetypesTableRows": [["Emerging", "Promedio < 25", "Comenzando"]],
        "about.scoring.tiersTableHeaders": ["Nivel", "Rango", "Descripción"],
        "about.scoring.tiersTableRows": [["Emerging", "0-29", "Comenzando"]],
        "about.scoring.confidenceTableHeaders": ["Patrón", "Penalización", "Desencadenante", "Qué significa"],
        "about.scoring.confidenceTableRows": [["Actividad en ráfaga", "-15", "100+ contribuciones", "Ráfagas extremas"]],
        "about.scoring.intro": "Transparencia total sobre cómo Chapa decodifica tu impacto.",
        "about.scoring.videoHeading": "Ver el vídeo explicativo",
        "about.scoring.videoTitle": "Cómo puntúa Chapa el impacto",
        "about.scoring.videoReadingNote": "Prefiero leer? La metodología está abajo.",
      };
      return map[key] ?? (key.split('.').pop() ?? key);
    });
    const { default: ScoringPage } = await import("./scoring/page");
    render(await ScoringPage({ searchParams: Promise.resolve({ lang: "es" }) }));
    expect(screen.getByText("Metodología de puntuación")).toBeDefined();
    expect(screen.getByText("Filosofía")).toBeDefined();
  });
});

describe("VerificationPage render (en)", () => {
  it("renders the verification page heading in en", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("en");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {
        "about.verification.h1": "Badge Verification",
        "about.verification.sectionWhy": "Why verification exists",
        "about.verification.whatTableHeaders": ["Field", "Example", "Why included"],
        "about.verification.whatTableRows": [["Handle", "juan294", "Developer identifier"]],
        "about.verification.designTableHeaders": ["Decision", "Rationale"],
        "about.verification.designTableRows": [["HMAC-SHA256", "Industry standard."]],
        "about.verification.ctaHeading": "Try it yourself",
        "about.verification.ctaButton": "Verify a Badge",
        "about.verification.intro": "Every Chapa badge carries a verification hash.",
        "about.verification.sectionHow": "How it works",
        "about.verification.sectionWhat": "What data is signed",
        "about.verification.sectionGuarantees": "What it guarantees",
        "about.verification.sectionLimits": "What it does not guarantee",
        "about.verification.sectionHowTo": "How to verify a badge",
        "about.verification.sectionDesign": "Design decisions",
      };
      return map[key] ?? (key.split('.').pop() ?? key);
    });
    const { default: VerificationPage } = await import("./verification/page");
    render(await VerificationPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("navbar")).toBeDefined();
    expect(screen.getByText("Badge Verification")).toBeDefined();
    expect(screen.getByText("Why verification exists")).toBeDefined();
  });
});

describe("VerificationPage render (es)", () => {
  it("renders the verification page heading in es", async () => {
    const { getServerLocale, getServerT } = await import("@/lib/i18n/server");
    vi.mocked(getServerLocale).mockResolvedValue("es");
    vi.mocked(getServerT).mockReturnValue((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map: Record<string, any> = {
        "about.verification.h1": "Verificación de Chapa",
        "about.verification.sectionWhy": "Por qué existe la verificación",
        "about.verification.whatTableHeaders": ["Campo", "Ejemplo", "Por qué se incluye"],
        "about.verification.whatTableRows": [["Handle", "juan294", "Identifica al desarrollador"]],
        "about.verification.designTableHeaders": ["Decisión", "Justificación"],
        "about.verification.designTableRows": [["HMAC-SHA256", "Estándar de la industria."]],
        "about.verification.ctaHeading": "Pruébalo tú mismo",
        "about.verification.ctaButton": "Verificar una Chapa",
        "about.verification.intro": "Cada Chapa lleva un hash de verificación.",
        "about.verification.sectionHow": "Cómo funciona",
        "about.verification.sectionWhat": "Qué datos se firman",
        "about.verification.sectionGuarantees": "Qué garantiza",
        "about.verification.sectionLimits": "Qué no garantiza",
        "about.verification.sectionHowTo": "Cómo verificar una Chapa",
        "about.verification.sectionDesign": "Decisiones de diseño",
      };
      return map[key] ?? (key.split('.').pop() ?? key);
    });
    const { default: VerificationPage } = await import("./verification/page");
    render(await VerificationPage({ searchParams: Promise.resolve({ lang: "es" }) }));
    expect(screen.getByText("Verificación de Chapa")).toBeDefined();
    expect(screen.getByText("Por qué existe la verificación")).toBeDefined();
  });
});

describe("AboutLoading render", () => {
  it("renders a status element", async () => {
    // Async server component (#884): await the call before rendering.
    render(await AboutLoading());
    expect(screen.getByRole("status")).toBeDefined();
  });
});

describe("AboutError render", () => {
  it("renders the error heading", () => {
    const reset = vi.fn();
    render(<AboutError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("calls reset on try again click", () => {
    const reset = vi.fn();
    render(<AboutError error={new Error("test") as Error & { digest?: string }} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

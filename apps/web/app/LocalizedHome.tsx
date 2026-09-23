import { SCORING_POLICY } from "@chapa/shared";
import type { ScoringRenderSelection } from "@/lib/scoring-render-selection";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { buildBadgeI18nStrings } from "@/lib/render/badge-i18n-strings";
import { DEMO_STATS } from "@/lib/render/demoData";
import { LANDING_OBSERVED_DEMO } from "@/lib/render/observed-demo-data";
import { LANDING_IMPACT } from "@/lib/render/landing-demo-data";
import { LandingContent } from "./LandingContent";
import { DEFAULT_LOCALE, LangSync, LanguageProvider } from "@/lib/i18n";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { getServerT } from "@/lib/i18n/server";
import { isSupportedLocale } from "@/lib/i18n/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentLocaleMarker } from "@/lib/i18n/document-locale";
import { LandingWebMcpTools } from "@/components/LandingWebMcpTools";
import { getLeaderboard } from "@/lib/profile/leaderboard";

// The literal en/es route wrappers declare force-dynamic: the sample and
// standings must share one live scoring selection after a cutover.
// #1065 (FE-H1) — the root layout no longer sets a blanket canonical, so
// every page (including this one) must declare its own. `/` is the one
// place a root-relative canonical is actually correct.
type HomeProps = {
  params: Promise<{ locale: string }>;
};

/**
 * #1335 phase 5 — the `scoring_v7_rendering` selector is retired; v7.2 is
 * the only rendered policy. `getLeaderboard` still takes the
 * `ScoringRenderSelection` shape, so this constant stands in for the old
 * dynamic DB-backed read. Factored out of the component body so the
 * `Date.now()` call isn't flagged as an impure call inside render
 * (react-hooks/purity) — this function is a plain helper, not a component.
 */
function currentScoringSelection(): ScoringRenderSelection {
  return {
    enabled: true,
    machinePolicy: SCORING_POLICY,
    cacheable: true,
    capturedAt: Date.now(),
  };
}

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const t = getServerT(locale);
  return {
    title: { absolute: t("meta.defaultTitle") as string },
    description: t("meta.defaultDescription") as string,
    alternates: {
      canonical: "/",
    },
  };
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const t = getServerT(locale);
  const selection = currentScoringSelection();
  const demoScoring = selection.enabled ? LANDING_OBSERVED_DEMO : undefined;
  const options = {
    scoring: demoScoring,
    includeBranding: true,
    demoMode: true,
    strings: buildBadgeI18nStrings(t, demoScoring ? demoScoring.tier : LANDING_IMPACT.tier),
  };
  const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, LANDING_IMPACT, options);
  const readmeBadgeSvg = renderBadgeSvg(DEMO_STATS, LANDING_IMPACT, {
    ...options,
    disableAnimation: true,
  });
  // A failed authority read produces no standings; no previous-policy rows
  // are substituted for unavailable current receipts.
  const topScored = await getLeaderboard(3, selection);
  return (
    <>
      <DocumentLocaleMarker locale={locale} />
      <LanguageProvider
        initialLocale={locale}
        // The static root provider always renders at DEFAULT_LOCALE. A request
        // selected for the OTHER locale therefore needs a matching client
        // provider for the navbar, controls, and document language; the default
        // locale reuses the root dictionary without serializing a second copy.
        //
        // #1201: this branch must pick the dictionary from `locale`, not
        // hardcode one. It previously read `: en`, which was only correct while
        // DEFAULT_LOCALE was 'es' and "non-default" could only mean English.
        // With the default flipped, that spelling handed the Spanish landing
        // page the English dictionary. Matches the shape already used by
        // /verify, /verify/[hash] and /u/[handle].
        dictionary={locale === DEFAULT_LOCALE ? undefined : locale === "es" ? es : en}
      >
        <LangSync />
        <LandingWebMcpTools />
        <LandingContent demoBadgeSvg={demoBadgeSvg} readmeBadgeSvg={readmeBadgeSvg} demoImpact={LANDING_IMPACT} demoScoring={demoScoring} topScored={topScored} t={t} />
      </LanguageProvider>
    </>
  );
}

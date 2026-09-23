import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { ArchetypePageContent } from "./ArchetypePageContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import {
  BUILDER_STATS, BUILDER_SCORING,
  GUARDIAN_STATS, GUARDIAN_SCORING,
  MARATHONER_STATS, MARATHONER_SCORING,
  POLYMATH_STATS, POLYMATH_SCORING,
  ARTIFICER_STATS, ARTIFICER_SCORING,
  BALANCED_STATS, BALANCED_SCORING,
  EMERGING_STATS, EMERGING_SCORING,
} from "@/lib/render/archetypeDemoData";
import type { StatsData } from "@chapa/shared";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";

export type ArchetypeKey = 'builder' | 'guardian' | 'marathoner' | 'polymath' | 'artificer' | 'balanced' | 'emerging';

const DEMO_DATA: Record<ArchetypeKey, { stats: StatsData; scoring: ScoreViewModel }> = {
  builder: { stats: BUILDER_STATS, scoring: BUILDER_SCORING },
  guardian: { stats: GUARDIAN_STATS, scoring: GUARDIAN_SCORING },
  marathoner: { stats: MARATHONER_STATS, scoring: MARATHONER_SCORING },
  polymath: { stats: POLYMATH_STATS, scoring: POLYMATH_SCORING },
  artificer: { stats: ARTIFICER_STATS, scoring: ARTIFICER_SCORING },
  balanced: { stats: BALANCED_STATS, scoring: BALANCED_SCORING },
  emerging: { stats: EMERGING_STATS, scoring: EMERGING_SCORING },
};

interface Props {
  archetypeKey: ArchetypeKey;
  locale: Locale;
}

/**
 * #1023 (FE-H1) — `locale` is sourced from the route's `[locale]` segment
 * param (populated by proxy.ts), not a hardcoded DEFAULT_LOCALE
 * constant. Both locale variants are statically pre-rendered, so there is
 * no client-side re-render/flash. The demo badge SVG itself is rendered
 * server-side from hardcoded, locale-independent archetype demo data.
 */
export async function ArchetypePage({ archetypeKey, locale }: Props) {
  const demoData = DEMO_DATA[archetypeKey];
  // SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping.
  const badgeSvg = renderBadgeSvg(demoData.stats, {
    scoring: demoData.scoring,
    includeBranding: true,
    demoMode: true,
  });
  const t = getServerT(locale);

  return <ArchetypePageContent archetypeKey={archetypeKey} badgeSvg={badgeSvg} t={t} />;
}

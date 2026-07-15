import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { ArchetypePageClient } from "./ArchetypePageClient";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";
import {
  BUILDER_STATS, BUILDER_IMPACT,
  GUARDIAN_STATS, GUARDIAN_IMPACT,
  MARATHONER_STATS, MARATHONER_IMPACT,
  POLYMATH_STATS, POLYMATH_IMPACT,
  ARTIFICER_STATS, ARTIFICER_IMPACT,
  BALANCED_STATS, BALANCED_IMPACT,
  EMERGING_STATS, EMERGING_IMPACT,
} from "@/lib/render/archetypeDemoData";
import type { StatsData, ImpactV6Result } from "@chapa/shared";

export type ArchetypeKey = 'builder' | 'guardian' | 'marathoner' | 'polymath' | 'artificer' | 'balanced' | 'emerging';

const DEMO_DATA: Record<ArchetypeKey, { stats: StatsData; impact: ImpactV6Result }> = {
  builder: { stats: BUILDER_STATS, impact: BUILDER_IMPACT },
  guardian: { stats: GUARDIAN_STATS, impact: GUARDIAN_IMPACT },
  marathoner: { stats: MARATHONER_STATS, impact: MARATHONER_IMPACT },
  polymath: { stats: POLYMATH_STATS, impact: POLYMATH_IMPACT },
  artificer: { stats: ARTIFICER_STATS, impact: ARTIFICER_IMPACT },
  balanced: { stats: BALANCED_STATS, impact: BALANCED_IMPACT },
  emerging: { stats: EMERGING_STATS, impact: EMERGING_IMPACT },
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
  const badgeSvg = renderBadgeSvg(demoData.stats, demoData.impact, {
    includeBranding: true,
    demoMode: true,
  });
  const t = getServerT(locale);

  return <ArchetypePageClient archetypeKey={archetypeKey} badgeSvg={badgeSvg} t={t} />;
}

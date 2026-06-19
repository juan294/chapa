import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { LocaleSync } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import Link from "next/link";
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

const ACCENT_CLASS: Record<ArchetypeKey, string> = {
  builder: 'text-archetype-builder',
  guardian: 'text-archetype-guardian',
  marathoner: 'text-archetype-marathoner',
  polymath: 'text-archetype-polymath',
  artificer: 'text-archetype-artificer',
  balanced: 'text-archetype-balanced',
  emerging: 'text-archetype-emerging',
};

interface Props {
  archetypeKey: ArchetypeKey;
  searchParams: Promise<Record<string, string>>;
}

export async function ArchetypePage({ archetypeKey, searchParams }: Props) {
  const params = await searchParams;
  const locale = await getServerLocale(params.lang);
  const t = getServerT(locale);
  const ns = `archetypes.${archetypeKey}`;

  const demoData = DEMO_DATA[archetypeKey];
  // SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping.
  const badgeSvg = renderBadgeSvg(demoData.stats, demoData.impact, {
    includeBranding: true,
    demoMode: true,
  });

  const essay = t(`${ns}.essay`) as string[];
  const keySignals = t(`${ns}.keySignals`) as Array<{ tier: string; description: string }>;
  const accentClass = ACCENT_CLASS[archetypeKey];

  // Guardian has additional solo key signals
  const keySignalsSoloRaw = t(`${ns}.keySignalsSolo`);
  const keySignalsSolo = Array.isArray(keySignalsSoloRaw)
    ? (keySignalsSoloRaw as Array<{ tier: string; description: string }>)
    : null;
  const keySignalsSoloHeading = typeof t(`${ns}.keySignalsSoloHeading`) === 'string'
    ? (t(`${ns}.keySignalsSoloHeading`) as string)
    : null;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <LocaleSync queryLang={params.lang} />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">{t(`${ns}.terminalCommand`) as string}</span>
          </div>
          <div className="pl-4 border-l border-stroke space-y-8">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                {t(`${ns}.h1Before`) as string}<span className={accentClass}>{t(`${ns}.h1Highlight`) as string}</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                {t('archetypes.dominantDimensionLabel') as string} <span className={accentClass}>{t(`${ns}.dominantDimension`) as string}</span>
              </p>
            </div>
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label={t(`${ns}.badgeAriaLabel`) as string}
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              {essay.map((p, i) => <p key={i}>{p}</p>)}

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                {t(`${ns}.sectionIdentifies`) as string}
              </h2>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                {t(`${ns}.keySignalsHeading`) as string}
              </h3>
              <div className="space-y-2">
                {keySignals.map((sig, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                    <span className={`${accentClass} font-heading text-sm shrink-0 sm:w-36`}>{sig.tier}</span>
                    <span className="text-text-secondary text-sm">{sig.description}</span>
                  </div>
                ))}
              </div>

              {keySignalsSolo && keySignalsSoloHeading && (
                <>
                  <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                    {keySignalsSoloHeading}
                  </h3>
                  <div className="space-y-2">
                    {keySignalsSolo.map((sig, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                        <span className={`${accentClass} font-heading text-sm shrink-0 sm:w-36`}>{sig.tier}</span>
                        <span className="text-text-secondary text-sm">{sig.description}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                {t(`${ns}.sectionPractice`) as string}
              </h2>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                {t(`${ns}.sectionRadar`) as string}
              </h2>
            </div>
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
              <Link href="/#features" className="font-heading text-sm text-amber hover:text-amber-light transition-colors">
                {t(`${ns}.backLink`) as string}
              </Link>
              <Link href="/about/scoring" className="font-heading text-sm text-text-secondary hover:text-amber transition-colors">
                {t(`${ns}.methodologyLink`) as string}
              </Link>
            </div>
          </div>
        </article>
      </main>
      <GlobalCommandBarLazy />
    </div>
  );
}

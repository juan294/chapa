import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import Link from "next/link";

export type ArchetypeKey = 'builder' | 'guardian' | 'marathoner' | 'polymath' | 'artificer' | 'balanced' | 'emerging';
type TFunction = (key: string) => unknown;

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
  badgeSvg: string;
  t: TFunction;
}

/**
 * Server-rendered archetype guide content (#1023 / FE-H1). `t` is
 * `getServerT(locale)`, resolved from the route's `[locale]` segment param —
 * both locale variants are statically pre-rendered, so there is no
 * client-side re-render/flash.
 */
export function ArchetypePageClient({ archetypeKey, badgeSvg, t }: Props) {
  const ns = `archetypes.${archetypeKey}`;

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
      <NavbarClient />
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

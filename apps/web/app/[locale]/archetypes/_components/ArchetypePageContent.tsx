import { NavbarClient } from "@/components/NavbarClient";
import { ContentPageHeader } from "@/components/content/ContentPageHeader";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";
import { tArray } from "@/lib/i18n/typed-accessors";
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
export function ArchetypePageContent({ archetypeKey, badgeSvg, t }: Props) {
  const ns = `archetypes.${archetypeKey}`;

  const essay = tArray<string>(t, `${ns}.essay`);
  const practiceEssay = tArray<string>(t, `${ns}.practiceEssay`);
  const radarEssay = tArray<string>(t, `${ns}.radarEssay`);
  const keySignals = tArray<{ tier: string; description: string }>(t, `${ns}.keySignals`);
  const accentClass = ACCENT_CLASS[archetypeKey];

  // Guardian has additional solo key signals. This key is legitimately absent
  // for the other six archetypes (resolveTranslation falls back to returning
  // the key itself), so this intentionally stays a manual Array.isArray guard
  // rather than tArray: tArray's console.warn on a shape mismatch would fire
  // on every non-guardian archetype page load, which isn't a malformed-data
  // warning worth surfacing — it's expected, optional-field behavior.
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
      {/* pb-24 (was pb-16, #1167 / UX-B1) — GlobalCommandBarLazy is
          fixed bottom-0; the smaller reservation left the footer added
          below occluded behind it. */}
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <article className="@container animate-fade-in-up">
          {/* #1218 — the shared content-page header, so an archetype guide
              opens the same way as every other long-form route. The guides
              stay on this shared shell rather than getting bespoke art. */}
          <ContentPageHeader
            command={t(`${ns}.terminalCommand`) as string}
            title={
              <>
                {t(`${ns}.h1Before`) as string}
                <span className={accentClass}>
                  {t(`${ns}.h1Highlight`) as string}
                </span>
              </>
            }
            intro={
              <span className="font-heading text-sm">
                {t('archetypes.dominantDimensionLabel') as string}{" "}
                <span className={accentClass}>
                  {t(`${ns}.dominantDimension`) as string}
                </span>
              </span>
            }
          />
          <div className="pl-4 border-l border-stroke space-y-8">
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
              {practiceEssay.map((p, i) => <p key={i}>{p}</p>)}

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                {t(`${ns}.sectionRadar`) as string}
              </h2>
              {radarEssay.map((p, i) => <p key={i}>{p}</p>)}
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
      {/* pb-16 spacer (#1167 / UX-B1) — reserves room below the footer so
          scrolling to the true bottom of the page clears GlobalCommandBarLazy
          (fixed bottom-0) instead of it occluding the footer's last line. */}
      <div className="pb-16">
        <SiteFooter t={t} showCta />
      </div>
      <GlobalCommandBarLazy />
    </div>
  );
}

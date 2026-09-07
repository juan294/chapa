import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";
import { LiteYouTubeEmbed } from "@/components/LiteYouTubeEmbed";
import { tArray } from "@/lib/i18n/typed-accessors";
import { ContentPageHeader } from "@/components/content/ContentPageHeader";
import { OnThisPageIndex } from "@/components/content/OnThisPageIndex";

type TFunction = (key: string) => unknown;

/* ---------------------------------------------------------------------- */
/* Reusable sub-components                                                 */
/* ---------------------------------------------------------------------- */

/**
 * #1218 — sections carry a stable anchor id so the sticky index can link to
 * them and observe them, and a rule underneath so the page reads as a document
 * with parts rather than one continuous column of prose.
 */
function SectionHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-28 border-b border-stroke-strong pt-10 pb-2 font-heading text-xl font-semibold tracking-tight text-text-primary sm:text-2xl"
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-heading text-lg font-medium text-text-primary tracking-tight pt-4 pb-1">
      {children}
    </h3>
  );
}

/** A published formula. Every dimension has one now, so it is a component
 *  rather than a repeated inline block. */
function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto rounded-[3px] border border-stroke bg-card p-4 font-heading text-sm text-text-primary">
      {children}
    </div>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stroke">
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="text-left py-2 px-3 font-heading text-text-primary font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stroke/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 px-3 ${j === 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/**
 * The sticky index's entries. Ids match the SectionHeading anchors below; the
 * labels come from the same dictionary keys the headings render, so the index
 * can never drift out of sync with the page it indexes.
 */
const SECTION_KEYS = [
  ["scoring-philosophy", "sectionPhilosophy"],
  ["scoring-window", "sectionWindow"],
  ["scoring-normalization", "sectionNormalization"],
  ["scoring-caps", "sectionCaps"],
  ["scoring-dimensions", "sectionDimensions"],
  ["scoring-craft", "sectionCraft"],
  ["scoring-ranges", "sectionRanges"],
  ["scoring-archetypes", "sectionArchetypes"],
  ["scoring-composite", "sectionComposite"],
  ["scoring-receipts", "sectionReceipts"],
  ["scoring-excludes", "sectionExcludes"],
] as const;

function SECTION_INDEX(t: TFunction) {
  return SECTION_KEYS.map(([id, key]) => ({
    id,
    label: t(`about.scoring.${key}`) as string,
  }));
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Server-rendered scoring methodology content (#1023 / FE-H1). `t` is
 * `getServerT(locale)`, resolved from the route's `[locale]` segment param —
 * both locale variants are statically pre-rendered, so there is no
 * client-side re-render/flash. No genuinely-interactive leaf is needed here;
 * `LiteYouTubeEmbed` and `GlobalCommandBarLazy` are already independent
 * client components.
 */
export function ScoringMethodologyContent({ t }: { t: TFunction }) {
  return (
    <div className="min-h-screen bg-bg">
      <NavbarClient />

      <main
        id="main-content"
        className="relative mx-auto max-w-5xl px-6 pt-32 pb-24"
      >
        <div className="@container relative">
          <ContentPageHeader
            command="chapa explain --scoring"
            title={t('about.scoring.h1') as string}
            intro={t('about.scoring.intro') as string}
          />

          {/* ---------------------------------------------------------- */}
          {/* Video explainer                                              */}
          {/* ---------------------------------------------------------- */}
          <div className="mb-10 animate-fade-in-up [animation-delay:150ms]">
            <div className="flex items-center gap-2 mb-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-amber"
                aria-hidden="true"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <h2 className="font-heading text-lg font-medium text-text-primary tracking-tight">
                {t('about.scoring.videoHeading') as string}
              </h2>
            </div>
            <LiteYouTubeEmbed
              // The v7 explainer. The earlier video described v6 scoring — confidence
              // penalties, EMA smoothing, a Craft dimension inside the core — none
              // of which this page documents any more.
              videoId="jJiNANmCBw0"
              title={t('about.scoring.videoTitle') as string}
            />
            <p className="text-text-secondary text-sm mt-2">
              {t('about.scoring.videoReadingNote') as string}
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <OnThisPageIndex
            items={SECTION_INDEX(t)}
            heading={t('content.onThisPage') as string}
          />
          <div className="min-w-0 space-y-2 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {/* ---------------------------------------------------------- */}
            {/* Philosophy                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-philosophy">{t('about.scoring.sectionPhilosophy') as string}</SectionHeading>
            <p>{t('about.scoring.philosophyBody1') as string}</p>
            <p>
              {t('about.scoring.philosophyBody2Prefix') as string}
              <strong className="text-text-primary">
                {t('about.scoring.philosophyBody2Highlight') as string}
              </strong>
              {t('about.scoring.philosophyBody2Suffix') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* One window, one clock                                       */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-window">{t('about.scoring.sectionWindow') as string}</SectionHeading>
            <p>{t('about.scoring.windowBody') as string}</p>
            <p>{t('about.scoring.windowNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Normalization                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-normalization">{t('about.scoring.sectionNormalization') as string}</SectionHeading>
            <p>
              {t('about.scoring.normalizationBody') as string}
              <strong className="text-text-primary">
                {t('about.scoring.normalizationHighlight') as string}
              </strong>
              {t('about.scoring.normalizationBodySuffix') as string}
            </p>
            <Formula>{t('about.scoring.normalizationFormula') as string}</Formula>
            <p>{t('about.scoring.normalizationCurveNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Caps                                                        */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-caps">{t('about.scoring.sectionCaps') as string}</SectionHeading>
            <p>{t('about.scoring.capsBody') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.capsTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.capsTableRows')}
            />

            {/* ---------------------------------------------------------- */}
            {/* The four core dimensions                                    */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-dimensions">{t('about.scoring.sectionDimensions') as string}</SectionHeading>
            <p>{t('about.scoring.dimensionsBody') as string}</p>

            <SubHeading>{t('about.scoring.deliveryHeading') as string}</SubHeading>
            <Formula>{t('about.scoring.deliveryFormula') as string}</Formula>
            <Table
              headers={tArray<string>(t, 'about.scoring.deliveryTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.deliveryTableRows')}
            />
            <p>{t('about.scoring.deliveryNote') as string}</p>

            <SubHeading>{t('about.scoring.qualityHeading') as string}</SubHeading>
            <Formula>{t('about.scoring.qualityFormula') as string}</Formula>
            <p>{t('about.scoring.qualityIntro') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.qualityTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.qualityTableRows')}
            />
            <p>{t('about.scoring.qualityNote') as string}</p>

            <SubHeading>{t('about.scoring.consistencyHeading') as string}</SubHeading>
            <Formula>{t('about.scoring.consistencyFormula') as string}</Formula>
            <p>{t('about.scoring.consistencyIntro') as string}</p>
            <p>{t('about.scoring.consistencyNote') as string}</p>

            <SubHeading>{t('about.scoring.breadthHeading') as string}</SubHeading>
            <Formula>{t('about.scoring.breadthFormula') as string}</Formula>
            <p>{t('about.scoring.breadthIntro') as string}</p>
            <p>{t('about.scoring.breadthNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Craft                                                       */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-craft">{t('about.scoring.sectionCraft') as string}</SectionHeading>
            <p>{t('about.scoring.craftIntro') as string}</p>
            <Formula>{t('about.scoring.craftFormula') as string}</Formula>
            <SubHeading>{t('about.scoring.craftHowToHeading') as string}</SubHeading>
            <p>
              {t('about.scoring.craftHowToBody') as string}<code className="bg-card px-1.5 py-0.5 rounded text-sm font-heading">{t('about.scoring.craftHowToCode') as string}</code>{t('about.scoring.craftHowToBodySuffix') as string}
            </p>
            <SubHeading>{t('about.scoring.craftWhatHeading') as string}</SubHeading>
            <p>{t('about.scoring.craftWhatIntro') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.craftTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.craftTableRows')}
            />
            <p>{t('about.scoring.craftFrictionNote1') as string}</p>
            <p>{t('about.scoring.craftArtificerNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Evidence-completion ranges                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-ranges">{t('about.scoring.sectionRanges') as string}</SectionHeading>
            <p>
              {t('about.scoring.rangesIntro1Prefix') as string}
              <strong className="text-text-primary">{t('about.scoring.rangesIntro1Highlight') as string}</strong>
              {t('about.scoring.rangesIntro1Suffix') as string}
            </p>
            <p>{t('about.scoring.rangesBody2') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.rangesTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.rangesTableRows')}
            />
            <p>{t('about.scoring.rangesNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Archetypes                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-archetypes">{t('about.scoring.sectionArchetypes') as string}</SectionHeading>
            <p>{t('about.scoring.archetypesIntro') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.archetypesTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.archetypesTableRows')}
            />
            <p>{t('about.scoring.archetypesTieBreaking') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* Composite score and tiers                                   */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-composite">{t('about.scoring.sectionComposite') as string}</SectionHeading>
            <p>{t('about.scoring.compositeIntro') as string}</p>
            <Formula>{t('about.scoring.compositeFormula1') as string}</Formula>
            <p>{t('about.scoring.compositeRoundingNote') as string}</p>
            <Table
              headers={tArray<string>(t, 'about.scoring.tiersTableHeaders')}
              rows={tArray<string[]>(t, 'about.scoring.tiersTableRows')}
            />

            {/* ---------------------------------------------------------- */}
            {/* Receipts                                                    */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-receipts">{t('about.scoring.sectionReceipts') as string}</SectionHeading>
            <p>
              {t('about.scoring.receiptsIntro1Prefix') as string}
              <strong className="text-text-primary">{t('about.scoring.receiptsIntro1Highlight') as string}</strong>
              {t('about.scoring.receiptsIntro1Suffix') as string}
            </p>
            <p>{t('about.scoring.receiptsBody2') as string}</p>
            <p>{t('about.scoring.receiptsBody3') as string}</p>
            <p>{t('about.scoring.receiptsConsentNote') as string}</p>

            {/* ---------------------------------------------------------- */}
            {/* What earns nothing                                          */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading id="scoring-excludes">{t('about.scoring.sectionExcludes') as string}</SectionHeading>
            <p>{t('about.scoring.excludesIntro') as string}</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-text-primary">{t('about.scoring.excludeFollowers') as string}</strong>
                {t('about.scoring.excludeFollowersSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">{t('about.scoring.excludeLOC') as string}</strong>
                {t('about.scoring.excludeLOCSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">{t('about.scoring.excludeTooling') as string}</strong>
                {t('about.scoring.excludeToolingSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">{t('about.scoring.excludeTenure') as string}</strong>
                {t('about.scoring.excludeTenureSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">{t('about.scoring.excludePrivate') as string}</strong>
                {t('about.scoring.excludePrivateSuffix') as string}
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* CTA                                                         */}
            {/* ---------------------------------------------------------- */}
            <div className="mt-16 rounded-[3px] border border-stroke bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight mb-3">
                {t('about.scoring.ctaHeading') as string}
              </h2>
              <p className="mb-4">
                {t('about.scoring.ctaBody') as string}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://x.com/juang294"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-action px-6 py-3 font-heading text-sm font-semibold text-action-text hover:bg-action-hover transition-colors"
                >
                  {t('about.scoring.ctaTwitter') as string}
                </a>
                <a
                  href="mailto:support@chapa.thecreativetoken.com"
                  className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-text-primary px-6 py-3 text-sm font-medium text-text-secondary hover:border-text-primary hover:text-text-primary transition-all"
                >
                  {t('about.scoring.ctaEmail') as string}
                </a>
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* pb-16 spacer (#1167 / UX-B1) — reserves room below the footer so
          scrolling to the true bottom of the page clears GlobalCommandBarLazy
          (fixed bottom-0) instead of it occluding the footer's last line. */}
      <div className="pb-16">
        <SiteFooter t={t} />
      </div>
      <GlobalCommandBarLazy />
    </div>
  );
}

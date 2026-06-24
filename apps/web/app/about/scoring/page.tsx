import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { LiteYouTubeEmbed } from "@/components/LiteYouTubeEmbed";
import { LocaleSync } from "@/lib/i18n";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t('about.scoring.metadataTitle') as string,
    description: t('about.scoring.metadataDescription') as string,
    openGraph: {
      title: t('about.scoring.ogTitle') as string,
      description: t('about.scoring.ogDescription') as string,
    },
    twitter: {
      card: "summary",
      title: t('about.scoring.twitterTitle') as string,
      description: t('about.scoring.twitterDescription') as string,
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Reusable sub-components                                                 */
/* ---------------------------------------------------------------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl sm:text-2xl font-semibold text-text-primary tracking-tight pt-8 pb-2">
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

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

export default async function ScoringMethodologyPage() {
  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    <div className="min-h-screen bg-bg">
      <LocaleSync />
      <NavbarClient />

      <main
        id="main-content"
        className="relative mx-auto max-w-3xl px-6 pt-32 pb-24"
      >
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4 animate-fade-in-up">
            {t('about.scoring.h1') as string}
            <span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <p className="text-text-secondary text-lg mb-8 animate-fade-in-up [animation-delay:100ms]">
            {t('about.scoring.intro') as string}
          </p>

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
              videoId="wcXXGn3JYyw"
              title={t('about.scoring.videoTitle') as string}
            />
            <p className="text-text-secondary text-sm mt-2">
              {t('about.scoring.videoReadingNote') as string}
            </p>
          </div>

          <div className="space-y-2 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {/* ---------------------------------------------------------- */}
            {/* Philosophy                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionPhilosophy') as string}</SectionHeading>
            <p>
              {t('about.scoring.philosophyBody1') as string}
            </p>
            <p>
              {t('about.scoring.philosophyBody2Prefix') as string}
              <strong className="text-text-primary">
                {t('about.scoring.philosophyBody2Highlight') as string}
              </strong>
              {t('about.scoring.philosophyBody2Suffix') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Normalization                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionNormalization') as string}</SectionHeading>
            <p>
              {t('about.scoring.normalizationBody') as string}
              <strong className="text-text-primary">
                {t('about.scoring.normalizationHighlight') as string}
              </strong>
              {t('about.scoring.normalizationBodySuffix') as string}
            </p>
            <div className="my-4 rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary">
              {t('about.scoring.normalizationFormula') as string}
            </div>
            <p>
              {t('about.scoring.normalizationCurveNote') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Caps                                                        */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionCaps') as string}</SectionHeading>
            <p>
              {t('about.scoring.capsBody') as string}
            </p>
            <Table
              headers={t('about.scoring.capsTableHeaders') as string[]}
              rows={t('about.scoring.capsTableRows') as unknown as string[][]}
            />

            {/* ---------------------------------------------------------- */}
            {/* The dimensions                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionDimensions') as string}</SectionHeading>
            <p>
              {t('about.scoring.dimensionsBody') as string}
            </p>

            {/* Delivery */}
            <SubHeading>{t('about.scoring.deliveryHeading') as string}</SubHeading>
            <Table
              headers={t('about.scoring.deliveryTableHeaders') as string[]}
              rows={t('about.scoring.deliveryTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.deliveryPrWeightNote1') as string}
            </p>
            <p>
              {t('about.scoring.deliveryPrWeightNote2') as string}
              <strong className="text-text-primary">
                {t('about.scoring.deliveryFlowHighlight') as string}
              </strong>
              {t('about.scoring.deliveryFlowSuffix') as string}
            </p>

            {/* Quality */}
            <SubHeading>
              {t('about.scoring.qualityHeading') as string}
            </SubHeading>
            <p>
              {t('about.scoring.qualityIntro') as string}
            </p>
            <SubHeading>{t('about.scoring.collaborativeQualityHeading') as string}</SubHeading>
            <Table
              headers={t('about.scoring.collaborativeQualityTableHeaders') as string[]}
              rows={t('about.scoring.collaborativeQualityTableRows') as unknown as string[][]}
            />
            <SubHeading>{t('about.scoring.soloQualityHeading') as string}</SubHeading>
            <Table
              headers={t('about.scoring.soloQualityTableHeaders') as string[]}
              rows={t('about.scoring.soloQualityTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.soloQualityNote') as string}
            </p>

            {/* Consistency */}
            <SubHeading>
              {t('about.scoring.consistencyHeading') as string}
            </SubHeading>
            <Table
              headers={t('about.scoring.consistencyTableHeaders') as string[]}
              rows={t('about.scoring.consistencyTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.consistencyNote1Prefix') as string}
              <strong className="text-text-primary">
                {t('about.scoring.consistencyNote1Highlight') as string}
              </strong>
              {t('about.scoring.consistencyNote1Suffix') as string}
            </p>

            {/* Breadth */}
            <SubHeading>{t('about.scoring.breadthHeading') as string}</SubHeading>
            <Table
              headers={t('about.scoring.breadthTableHeaders') as string[]}
              rows={t('about.scoring.breadthTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.breadthNote') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Craft dimension                                             */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionCraft') as string}</SectionHeading>
            <p>
              {t('about.scoring.craftIntro') as string}
            </p>
            <SubHeading>{t('about.scoring.craftHowToHeading') as string}</SubHeading>
            <p>
              {t('about.scoring.craftHowToBody') as string}<code className="bg-card px-1.5 py-0.5 rounded text-sm font-heading">{t('about.scoring.craftHowToCode') as string}</code>{t('about.scoring.craftHowToBodySuffix') as string}
            </p>
            <SubHeading>{t('about.scoring.craftWhatHeading') as string}</SubHeading>
            <p>
              {t('about.scoring.craftWhatIntro') as string}
            </p>
            <Table
              headers={t('about.scoring.craftTableHeaders') as string[]}
              rows={t('about.scoring.craftTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.craftFrictionNote1') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Archetypes                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionArchetypes') as string}</SectionHeading>
            <p>
              {t('about.scoring.archetypesIntro') as string}
            </p>
            <Table
              headers={t('about.scoring.archetypesTableHeaders') as string[]}
              rows={t('about.scoring.archetypesTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.archetypesTieBreaking') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Composite score and tiers                                   */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionComposite') as string}</SectionHeading>
            <p>
              {t('about.scoring.compositeIntro') as string}
            </p>
            <div className="my-4 rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary space-y-1">
              <p>{t('about.scoring.compositeFormula1') as string}</p>
              <p>
                {t('about.scoring.compositeFormula2') as string}
              </p>
            </div>
            <p>
              {t('about.scoring.compositeRecencyNote') as string}
            </p>
            <p>
              {t('about.scoring.compositeConfidenceNote') as string}
            </p>
            <Table
              headers={t('about.scoring.tiersTableHeaders') as string[]}
              rows={t('about.scoring.tiersTableRows') as unknown as string[][]}
            />

            {/* ---------------------------------------------------------- */}
            {/* Confidence system                                           */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionConfidence') as string}</SectionHeading>
            <p>
              {t('about.scoring.confidenceIntro1Prefix') as string}
              <strong className="text-text-primary">{t('about.scoring.confidenceIntro1Highlight') as string}</strong>
              {t('about.scoring.confidenceIntro1Suffix') as string}
            </p>
            <p>
              {t('about.scoring.confidenceIntro2') as string}
            </p>
            <Table
              headers={t('about.scoring.confidenceTableHeaders') as string[]}
              rows={t('about.scoring.confidenceTableRows') as unknown as string[][]}
            />
            <p>
              {t('about.scoring.confidenceFloor1Prefix') as string}
              <strong className="text-text-primary">{t('about.scoring.confidenceFloor1Highlight') as string}</strong>
              {t('about.scoring.confidenceFloor1Suffix') as string}
            </p>
            <p>
              {t('about.scoring.confidenceMutuallyExclusivePrefix') as string}
              <strong className="text-text-primary">{t('about.scoring.confidenceMutuallyExclusiveHighlight') as string}</strong>
              {t('about.scoring.confidenceMutuallyExclusiveSuffix') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Score smoothing                                             */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionSmoothing') as string}</SectionHeading>
            <p>
              {t('about.scoring.smoothingIntro1Prefix') as string}
              <strong className="text-text-primary">
                {t('about.scoring.smoothingIntro1Highlight') as string}
              </strong>
              {t('about.scoring.smoothingIntro1Suffix') as string}
            </p>
            <div className="my-4 rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary">
              {t('about.scoring.smoothingFormula') as string}
            </div>
            <p>
              {t('about.scoring.smoothingNote') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What we don't use                                           */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.scoring.sectionExcludes') as string}</SectionHeading>
            <p>
              {t('about.scoring.excludesIntro') as string}
            </p>
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
                <strong className="text-text-primary">
                  {t('about.scoring.excludePrivate') as string}
                </strong>
                {t('about.scoring.excludePrivateSuffix') as string}
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* CTA                                                         */}
            {/* ---------------------------------------------------------- */}
            <div className="mt-16 rounded-xl border border-stroke bg-card p-6 sm:p-8">
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
                  className="inline-flex items-center justify-center rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
                >
                  {t('about.scoring.ctaTwitter') as string}
                </a>
                <a
                  href="mailto:support@chapa.thecreativetoken.com"
                  className="inline-flex items-center justify-center rounded-lg border border-stroke px-6 py-3 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary transition-all"
                >
                  {t('about.scoring.ctaEmail') as string}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <GlobalCommandBarLazy />
    </div>
  );
}

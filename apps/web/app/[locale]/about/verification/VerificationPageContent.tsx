import Link from "next/link";
import { NavbarClient } from "@/components/NavbarClient";
import { ContentPageHeader } from "@/components/content/ContentPageHeader";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { SiteFooter } from "@/components/SiteFooter";
import { tArray } from "@/lib/i18n/typed-accessors";

type TFunction = (key: string) => unknown;

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
/* Icons                                                                   */
/* ---------------------------------------------------------------------- */

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Server-rendered badge-verification explainer content (#1023 / FE-H1). `t`
 * is `getServerT(locale)`, resolved from the route's `[locale]` segment
 * param — both locale variants are statically pre-rendered, so there is no
 * client-side re-render/flash. No genuinely-interactive leaf is needed here.
 */
export function VerificationPageContent({ t }: { t: TFunction }) {
  return (
    <div className="min-h-screen bg-bg">
      <NavbarClient />

      <main
        id="main-content"
        className="relative mx-auto max-w-3xl px-6 pt-32 pb-24"
      >
        <div className="@container relative">
          <ContentPageHeader
            command="chapa explain --verification"
            title={t('about.verification.h1') as string}
          />

          <p className="text-text-secondary text-lg mb-8 animate-fade-in-up [animation-delay:100ms]">
            {t('about.verification.intro') as string}
          </p>

          <div className="space-y-2 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {/* ---------------------------------------------------------- */}
            {/* Why verification exists                                     */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionWhy') as string}</SectionHeading>
            <p>
              {t('about.verification.whyBody1') as string}
            </p>
            <p>
              {t('about.verification.whyBody2Prefix') as string}
              <Link
                href="/verify"
                className="text-amber hover:text-amber-light transition-colors"
              >
                {t('about.verification.verifyPageLink') as string}
              </Link>
              {t('about.verification.whyBody2Suffix') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* How it works                                                */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionHow') as string}</SectionHeading>
            <p>
              {t('about.verification.howIntro') as string}
              <strong className="text-text-primary">{t('about.verification.howHighlight') as string}</strong>
              {t('about.verification.howSuffix') as string}
            </p>

            <ol className="list-decimal pl-6 space-y-3 my-4">
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.howStep1Heading') as string}
                </strong>
                {t('about.verification.howStep1Body') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.howStep2Heading') as string}
                </strong>
                {t('about.verification.howStep2Body') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.howStep3Heading') as string}
                </strong>
                {t('about.verification.howStep3Body') as string}
              </li>
            </ol>

            <p>
              {t('about.verification.howStorageNote') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What data is signed                                         */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionWhat') as string}</SectionHeading>
            <p>
              {t('about.verification.whatIntro') as string}
            </p>
            <Table
              headers={tArray<string>(t, 'about.verification.whatTableHeaders')}
              rows={tArray<string[]>(t, 'about.verification.whatTableRows')}
            />
            <p>
              {t('about.verification.whatDeterministicNote') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What it guarantees                                          */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionGuarantees') as string}</SectionHeading>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>
                <strong className="text-text-primary">{t('about.verification.guaranteeDataIntegrityHeading') as string}</strong>
                {t('about.verification.guaranteeDataIntegritySuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.guaranteeAuthenticityHeading') as string}
                </strong>
                {t('about.verification.guaranteeAuthenticitySuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.guaranteeDateHeading') as string}
                </strong>
                {t('about.verification.guaranteeDateSuffix') as string}
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* What it does not guarantee                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionLimits') as string}</SectionHeading>
            <p>
              {t('about.verification.limitsIntro') as string}
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.limitNotBlockchainHeading') as string}
                </strong>
                {t('about.verification.limitNotBlockchainSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.limitTrustHeading') as string}
                </strong>
                {t('about.verification.limitTrustSuffix') as string}
              </li>
              <li>
                <strong className="text-text-primary">
                  {t('about.verification.limitNotTamperProofHeading') as string}
                </strong>
                {t('about.verification.limitNotTamperProofSuffix') as string}
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* How to verify                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionHowTo') as string}</SectionHeading>
            <ol className="list-decimal pl-6 space-y-2 my-4">
              <li>
                {t('about.verification.howToStep1') as string}
              </li>
              <li>
                {t('about.verification.howToStep2Prefix') as string}
                <Link
                  href="/verify"
                  className="text-amber hover:text-amber-light transition-colors"
                >
                  {t('about.verification.howToStep2Link') as string}
                </Link>
                {t('about.verification.howToStep2Suffix') as string}
              </li>
              <li>
                {t('about.verification.howToStep3') as string}
              </li>
            </ol>
            <p>
              {t('about.verification.howToApiPrefix') as string}
              <code className="font-heading text-text-primary/80 bg-amber/10 px-1.5 py-0.5 rounded text-xs">
                GET /api/verify/&lt;hash&gt;
              </code>
              {t('about.verification.howToApiSuffix') as string}
              {' '}{t('about.verification.howToRateLimit') as string}
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Design decisions                                            */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>{t('about.verification.sectionDesign') as string}</SectionHeading>
            <Table
              headers={tArray<string>(t, 'about.verification.designTableHeaders')}
              rows={tArray<string[]>(t, 'about.verification.designTableRows')}
            />

            {/* ---------------------------------------------------------- */}
            {/* CTA                                                         */}
            {/* ---------------------------------------------------------- */}
            <div className="mt-16 rounded-xl border border-stroke bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight mb-3">
                {t('about.verification.ctaHeading') as string}
              </h2>
              <p className="mb-4">
                {t('about.verification.ctaBody') as string}
              </p>
              <Link
                href="/verify"
                className="group inline-flex items-center gap-2.5 rounded-lg bg-complement px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-complement/80 hover:shadow-xl hover:shadow-complement/25"
              >
                <ShieldCheckIcon className="w-4 h-4" />
                {t('about.verification.ctaButton') as string}
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
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

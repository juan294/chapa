"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NavbarClient } from "@/components/NavbarClient";
import { ContentPageHeader } from "@/components/content/ContentPageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LocaleSync, useTranslation } from "@/lib/i18n";
import { tArray } from "@/lib/i18n/typed-accessors";
import { VerifyForm } from "./VerifyForm";

export function VerifyInputPageClient() {
  const { t } = useTranslation();
  // #1167 (UX-B1) — real routes (/about, /about/scoring, /verify), not the
  // landing page's `landing.navLinks` hash anchors, which are meaningless
  // off that page. `translationKey` tells NavbarClient which dictionary key
  // to re-derive locale-aware labels from.
  const innerNavLinks = tArray<{ label: string; href: string }>(t, "nav.innerLinks");

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Suspense fallback={null}>
        <VerifyQueryLocale />
      </Suspense>
      <NavbarClient navLinks={innerNavLinks} translationKey="nav.innerLinks" />
      <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32 pb-16">
        <div className="@container animate-fade-in-up">
          <ContentPageHeader
            command="chapa verify"
            title={
              <>
                {t('verify.headingBefore') as string}{" "}
                <span className="text-complement-text">
                  {t('verify.headingHighlight') as string}
                </span>
              </>
            }
            intro={t('verify.instructions') as string}
          />

          <VerifyForm />

          {/* #1218 — the idle state says so, instead of leaving an unexplained
              empty page under the input. */}
          <div className="mt-8 rounded-xl border border-stroke bg-card p-5">
            <span className="font-heading text-xs tracking-wider text-terminal-dim uppercase">
              {t('verify.awaitingHash') as string}
            </span>
            <p className="mt-2 text-sm text-pretty text-text-secondary">
              {t('verify.awaitingHashBody') as string}
            </p>
          </div>

          {/* The honest limitation, kept on the page rather than buried in the
              explainer. Copy is the existing about.verification wording. */}
          <div className="mt-4 rounded-xl border border-stroke bg-card p-5">
            <h2 className="font-heading text-sm font-semibold text-text-primary">
              {t('about.verification.limitNotTamperProofHeading') as string}
            </h2>
            <p className="mt-2 text-sm text-pretty text-text-secondary">
              {(t('about.verification.limitNotTamperProofSuffix') as string).replace(
                /^\s*—\s*/,
                "",
              )}
            </p>
          </div>
        </div>
      </main>
      {/* #1167 (UX-B1) — no fixed-bottom command bar exists on this page
          (unlike the share page's CommandBarHint), so no spacer is needed. */}
      <SiteFooter t={t} />
    </div>
  );
}

function VerifyQueryLocale() {
  const searchParams = useSearchParams();
  return <LocaleSync queryLang={searchParams?.get("lang")} />;
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NavbarClient } from "@/components/NavbarClient";
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
        <div className="animate-fade-in-up">
          {/* Terminal command line */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa verify</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-6">
            <div>
              <h1 className="font-heading text-2xl tracking-tight">
                {t('verify.headingBefore') as string}{" "}
                <span className="text-complement-text">
                  {t('verify.headingHighlight') as string}
                </span>
              </h1>
              <p className="text-text-secondary text-sm mt-2">
                {t('verify.instructions') as string}
              </p>
            </div>

            <VerifyForm />
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

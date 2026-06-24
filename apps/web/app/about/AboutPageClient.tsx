"use client";

import Link from "next/link";
import { NavbarClient } from "@/components/NavbarClient";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { LocaleSync, useTranslation } from "@/lib/i18n";

export function AboutPageClient() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg">
      <LocaleSync />
      <NavbarClient />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            {t('about.index.h1') as string}<span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            {(t('about.index.intro') as string[]).map((p, i) => (
              <p key={i}>{p}</p>
            ))}

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionDimensions') as string}
            </h2>
            <p>
              {t('about.index.dimensionsBody') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionArchetypes') as string}
            </h2>
            <p>
              {t('about.index.archetypesBodyBefore') as string}
              <Link href="/archetypes/builder" className="font-semibold text-archetype-builder hover:text-amber-light transition-colors">Builder</Link>,{" "}
              <Link href="/archetypes/guardian" className="font-semibold text-archetype-guardian hover:text-archetype-guardian/70 transition-colors">Quality Champion</Link>,{" "}
              <Link href="/archetypes/marathoner" className="font-semibold text-archetype-marathoner hover:text-archetype-marathoner/70 transition-colors">Marathoner</Link>,{" "}
              <Link href="/archetypes/polymath" className="font-semibold text-archetype-polymath hover:text-archetype-polymath/70 transition-colors">Polymath</Link>,{" "}
              <Link href="/archetypes/artificer" className="font-semibold text-archetype-artificer hover:text-archetype-artificer/70 transition-colors">Artificer</Link>,{" "}
              <Link href="/archetypes/balanced" className="font-semibold text-archetype-balanced hover:text-text-primary transition-colors">Balanced</Link>, {t('common.orConnector') as string}{" "}
              <Link href="/archetypes/emerging" className="font-semibold text-archetype-emerging hover:text-text-secondary transition-colors">Emerging</Link>
              {t('about.index.archetypesBodyAfter') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionPrivacy') as string}
            </h2>
            <p>
              {t('about.index.privacyBody') as string}{" "}
              <Link
                href="/about/scoring"
                className="text-amber hover:text-amber-light transition-colors"
              >
                {t('about.index.scoringLinkLabel') as string}
              </Link>
              {t('about.index.privacyBodyMiddle') as string}
              <Link
                href="/about/verification"
                className="text-amber hover:text-amber-light transition-colors"
              >
                {t('about.index.verificationLinkLabel') as string}
              </Link>
              {t('about.index.privacyBodyEnd') as string}
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              {t('about.index.sectionContact') as string}
            </h2>
            <p>
              {t('about.index.contactBody') as string}
              <a
                href={`mailto:${t('about.index.contactEmail') as string}`}
                className="text-amber hover:text-amber-light transition-colors"
              >
                {t('about.index.contactEmail') as string}
              </a>
              {t('about.index.contactBodyEnd') as string}
            </p>
          </div>
        </div>
      </main>

      <GlobalCommandBarLazy />
    </div>
  );
}

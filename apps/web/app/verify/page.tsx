import type { Metadata } from "next";
import { NavbarClient } from "@/components/NavbarClient";
import { LocaleSync } from "@/lib/i18n";
import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { VerifyForm } from "./VerifyForm";

export const revalidate = 3600;
export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const t = getServerT(DEFAULT_LOCALE);
  return {
    title: t('verify.title') as string,
    description: t('verify.description') as string,
    robots: { index: false, follow: true },
  };
}

export default async function VerifyInputPage() {
  const t = getServerT(DEFAULT_LOCALE);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <LocaleSync />
      <NavbarClient />
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
                <span className="text-complement">
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
    </div>
  );
}

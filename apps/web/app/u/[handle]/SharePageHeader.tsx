"use client";

import { useTranslation } from "@/lib/i18n";

interface SharePageHeaderProps {
  handle: string;
  /** Display name when GitHub has one, otherwise the handle. */
  displayLabel: string;
}

/**
 * The share page header (#1217).
 *
 * Before this, the page opened with an sr-only h1 and a small uppercase
 * "Your Impact, Decoded" line: nothing on screen named whose profile it was.
 *
 * The score, tier and verification state are drawn by the badge directly
 * below, so repeating them here only made the header taller.
 *
 * It once accepted `score`, `tier` and `verificationHash` and rendered none of
 * them. They are gone (#1311): a v6 score arriving at a component that looks
 * like it displays one is exactly the trap a reader falls into — a review of
 * the v7 cutover read those props as a live contradiction with the badge below.
 * A prop that is never rendered should not exist.
 */
export function SharePageHeader({ handle, displayLabel }: SharePageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="@container mb-8">
      <div className="font-heading text-sm [overflow-wrap:anywhere] text-text-secondary">
        <span className="select-none text-amber-text">%</span> chapa profile @
        {handle}
      </div>

      <div className="mt-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[clamp(1.75rem,5cqi,2.75rem)] leading-tight tracking-tight text-balance [overflow-wrap:anywhere]">
            {displayLabel}
          </h1>
          <p className="mt-2 text-sm text-pretty text-text-secondary">
            {t("sharePage.subtitle") as string}
          </p>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

interface SharePageHeaderProps {
  handle: string;
  /** Display name when GitHub has one, otherwise the handle. */
  displayLabel: string;
  score: number | null;
  tier: string | null;
  /** Present only when the profile carries an HMAC verification record. */
  verificationHash?: string | null;
}

/**
 * The share page header (#1217).
 *
 * Before this, the page opened with an sr-only h1 and a small uppercase
 * "Your Impact, Decoded" line: nothing on screen named whose profile it was,
 * and the score only appeared inside the badge image. The header now pairs the
 * identity block with the headline number, its tier, and the verification
 * pill, so the three things a visitor came for are readable before the badge
 * finishes painting.
 *
 * The verification pill stays in the slate-blue complement family, never jade:
 * cryptographic trust is a different signal from a brand action. It uses
 * `text-complement-text`, the text-safe token, rather than the raw fill value.
 */
export function SharePageHeader({
  handle,
  displayLabel,
  score,
  tier,
  verificationHash,
}: SharePageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="@container mb-8">
      <div className="font-heading text-sm whitespace-nowrap text-text-secondary">
        <span className="select-none text-amber">%</span> chapa profile @
        {handle}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[clamp(1.75rem,5cqi,2.75rem)] leading-tight tracking-tight text-balance">
            {displayLabel}
          </h1>
          <p className="mt-2 text-sm text-pretty text-text-secondary">
            {t("sharePage.subtitle") as string}
          </p>
        </div>

        {score !== null && (
          <div className="flex items-end gap-4">
            <div className="text-right">
              <div className="font-heading text-[clamp(2.75rem,7cqi,4.75rem)] leading-none tabular-nums tracking-tight text-amber">
                {score}
              </div>
              <div className="font-heading text-xs text-terminal-dim">
                {t("sharePage.impactScoreCaption") as string}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2">
              {tier && (
                <span className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1 font-heading text-xs tracking-wider text-amber uppercase">
                  {tier}
                </span>
              )}
              {verificationHash && (
                <Link
                  href={`/verify/${verificationHash}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-complement px-3 py-1 font-heading text-xs whitespace-nowrap text-complement-text transition-colors hover:text-complement-text-hover"
                >
                  <span aria-hidden="true">&#9679;</span>
                  {t("badge.metricsVerified") as string}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

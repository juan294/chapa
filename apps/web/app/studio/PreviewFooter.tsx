"use client";

import type { Platform } from "@chapa/shared";
import type { PublicVerificationCode } from "@/lib/profile/public-profile";
import {
  PLATFORM_LOGOS,
  PLATFORM_ORDER,
} from "@/lib/render/BadgeBranding";
import { CORAL } from "@/lib/render/VerificationStrip";
import { getBaseUrl } from "@/lib/env";
import { useTranslation } from "@/lib/i18n";

export type PreviewVerification = PublicVerificationCode;

interface PreviewFooterProps {
  linkedPlatforms: Platform[];
  verification: PreviewVerification | null;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  github: "GitHub",
  bitbucket: "Bitbucket",
  codeberg: "Codeberg",
  gitlab: "GitLab",
};

export function PreviewFooter({
  linkedPlatforms,
  verification,
}: PreviewFooterProps) {
  const { t } = useTranslation();
  const platforms = PLATFORM_ORDER.filter((platform) =>
    linkedPlatforms.includes(platform),
  );
  const host = new URL(getBaseUrl()).host;

  return (
    <footer className="mt-4 pt-3 border-t border-stroke/50">
      <div className="flex items-center justify-between gap-3 text-xs text-text-secondary/60">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex shrink-0 items-center gap-2 rounded-full border border-amber/15 bg-amber/[0.08] px-2.5 py-1.5"
            role="group"
            aria-label={t("aria.connectedPlatforms") as string}
          >
            {platforms.map((platform) => (
              <svg
                key={platform}
                data-platform={platform}
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label={PLATFORM_LABELS[platform]}
              >
                <path d={PLATFORM_LOGOS[platform]} />
              </svg>
            ))}
          </div>
          <span className="hidden truncate sm:inline">
            Forged from purpose. Driven by curiosity.
          </span>
        </div>
        <span className="shrink-0 font-heading">{host}</span>
      </div>

      {verification && (
        <div
          className="mt-3 border-t pt-2 text-center font-heading text-[10px] tracking-[0.12em] opacity-60"
          style={{ color: CORAL, borderColor: `${CORAL}26` }}
        >
          VERIFIED · {verification.hash} · {verification.date}
        </div>
      )}
    </footer>
  );
}

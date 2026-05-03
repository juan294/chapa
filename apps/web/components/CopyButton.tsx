"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import { useTranslation } from "@/lib/i18n";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    trackEvent("embed_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      aria-label={t('aria.copyEmbed') as string}
      className="relative min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-text-secondary hover:text-amber transition-colors"
    >
      <span aria-live="polite" className="sr-only">{copied ? t('common.copied') as string : t('common.copy') as string}</span>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
          copied ? "opacity-0 scale-75" : "opacity-100 scale-100"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </span>
      <span
        className={`flex items-center justify-center transition-all duration-150 ${
          copied ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    </button>
  );
}

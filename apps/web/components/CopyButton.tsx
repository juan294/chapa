"use client";

import { trackEvent } from "@/lib/analytics/posthog";
import { useTranslation } from "@/lib/i18n";
import { CopyIcon } from "@/components/icons";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export function CopyButton({ text }: { text: string }) {
  const { status, copy } = useCopyToClipboard();
  const { t } = useTranslation();

  const handleCopy = async () => {
    const ok = await copy(text);
    if (ok) trackEvent("embed_copied");
  };

  // #1165 (UX-M4) — a rejected clipboard write must surface a visible
  // failure state, not silently do nothing (there was previously no catch
  // here at all — an unhandled rejection). `badgeToolbar.failed` ("Failed")
  // is reused here as the shared generic failure word rather than adding a
  // new dictionary key (dictionaries are owned by a separate remediation
  // issue — see PR/report notes).
  const statusText =
    status === "copied"
      ? (t('common.copied') as string)
      : status === "failed"
        ? (t('badgeToolbar.failed') as string)
        : (t('common.copy') as string);

  return (
    <button
      onClick={handleCopy}
      aria-label={t('aria.copyEmbed') as string}
      className="relative min-h-[44px] min-w-[44px] p-2.5 rounded-lg text-text-secondary hover:text-amber transition-colors"
    >
      <span aria-live="polite" className="sr-only">{statusText}</span>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
          status === "idle" ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <CopyIcon width="16" height="16" />
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
          status === "copied" ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center text-terminal-red transition-all duration-150 ${
          status === "failed" ? "opacity-100 scale-100" : "opacity-0 scale-75"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      </span>
    </button>
  );
}

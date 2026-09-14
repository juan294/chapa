"use client";

import { useCallback, useEffect } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTranslation } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics/posthog";

/** The pointer control and scoped /copy command share the same real write. */
export function LandingCopyButton({ text }: { text: string }) {
  const { status, copy } = useCopyToClipboard();
  const { t } = useTranslation();
  const handleCopy = useCallback(async () => {
    const ok = await copy(text);
    if (ok) trackEvent("embed_copied");
    return ok;
  }, [copy, text]);
  useEffect(() => {
    const request = (event: Event) => {
      const complete = (event as CustomEvent<{ complete?: (ok: boolean) => void }>).detail?.complete;
      void handleCopy().then((ok) => { if (typeof complete === "function") complete(ok); });
    };
    window.addEventListener("chapa:landing-copy", request);
    return () => window.removeEventListener("chapa:landing-copy", request);
  }, [handleCopy]);
  const feedback = status === "copied" ? t("common.copied") : status === "failed" ? t("badgeToolbar.failed") : "";
  return <div className="shrink-0">
    <button type="button" onClick={() => void handleCopy()} aria-label={t("aria.copyEmbed") as string} className="min-h-11 border border-text-primary px-4 font-heading text-xs text-text-primary hover:bg-purple-tint">{t("common.copy") as string} ↗</button>
    <span role="status" className="mt-1 block font-heading text-[11px] text-text-secondary">{feedback as string}</span>
  </div>;
}

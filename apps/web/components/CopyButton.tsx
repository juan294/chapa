"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics/posthog";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    trackEvent("embed_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy embed snippet"
      className="rounded-full border border-warm-stroke bg-warm-card px-4 py-1.5 text-sm text-text-secondary hover:border-amber/20 hover:text-text-primary transition-colors"
    >
      <span aria-live="polite">{copied ? "Copied!" : "Copy"}</span>
    </button>
  );
}

"use client";

import { trackEvent } from "@/lib/analytics/posthog";

export function ShareButton({ handle }: { handle: string }) {
  const shareUrl = `https://chapa.thecreativetoken.com/u/${handle}`;
  const text = encodeURIComponent(
    `Check out my developer impact badge on Chapa! ${shareUrl}`,
  );

  return (
    <a
      href={`https://x.com/intent/tweet?text=${text}`}
      onClick={() => trackEvent("share_clicked", { platform: "x" })}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share on X (opens in new window)"
      className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-lg hover:shadow-amber/25"
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share on X
    </a>
  );
}

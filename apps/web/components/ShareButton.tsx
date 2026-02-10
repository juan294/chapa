/**
 * Share-on-X button stub (Teammate E).
 * Will open X compose with prefilled message.
 */

"use client";

export function ShareButton({ handle }: { handle: string }) {
  const shareUrl = `https://chapa.thecreativetoken.com/u/${handle}`;
  const text = encodeURIComponent(
    `Check out my developer impact badge on Chapa! ${shareUrl}`,
  );

  return (
    <a
      href={`https://x.com/intent/tweet?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg bg-mint/10 px-4 py-2 text-mint font-medium hover:bg-mint/20 transition-colors"
    >
      Share on X
    </a>
  );
}

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
      className="rounded-full bg-amber/10 px-6 py-2.5 text-amber font-semibold hover:bg-amber/20 transition-colors"
    >
      Share on X
    </a>
  );
}

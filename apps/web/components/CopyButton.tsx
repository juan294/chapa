/**
 * Copy-to-clipboard button stub (Teammate E).
 * Will copy embed snippets and track via PostHog.
 */

"use client";

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="rounded bg-card px-3 py-1.5 text-sm text-text-secondary border border-stroke hover:text-text-primary transition-colors"
    >
      Copy
    </button>
  );
}

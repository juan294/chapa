/**
 * Badge preview component stub (Teammate E).
 * Displays the badge image on the share page.
 */

export function BadgePreview({ handle }: { handle: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/u/${encodeURIComponent(handle)}/badge.svg`}
      alt={`Chapa badge for ${handle}`}
      width={600}
      height={315}
    />
  );
}

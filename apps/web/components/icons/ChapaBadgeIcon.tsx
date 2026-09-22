import type { SVGProps } from "react";

/**
 * Chapa shield + chevron (stroke). The same mark as the favicon
 * (`public/favicon.svg`) and the badge's avatar placeholder, drawn in
 * `currentColor` so it inherits the surrounding text color.
 *
 * Use it wherever the product's own badge is meant, rather than a platform
 * logo: a badge belongs to Chapa, and GitHub is one of four sources it can
 * read. Decorative — always `aria-hidden`.
 */
export function ChapaBadgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M16 4 L26 8 L26 15 C26 21 21 26 16 28 C11 26 6 21 6 15 L6 8 Z" />
      <path d="M12 19 L16 13 L20 19" strokeWidth="2.4" />
    </svg>
  );
}

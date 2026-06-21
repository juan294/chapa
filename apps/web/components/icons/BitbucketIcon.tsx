import type { SVGProps } from "react";

/**
 * Bitbucket mark (fill). Decorative — always `aria-hidden`. Accepts standard
 * SVG props (e.g. `className`, `width`, `height`) so call sites can size it
 * the same way they did with inline markup.
 */
export function BitbucketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

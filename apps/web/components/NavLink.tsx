"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
  className?: string;
}

/**
 * Client-side nav link that adds `aria-current="page"` when the href
 * matches the current pathname. Used inside the server-rendered Navbar.
 *
 * #1184 (FE-L3): real internal routes (e.g. `/about`, `/studio`) use
 * `next/link` for client-side navigation instead of a full document reload.
 * Hash anchors (`#features`, in-page scroll on the landing page) and
 * external URLs are not Next.js routes, so they stay plain `<a>` tags.
 *
 * `/u/:handle` is a deliberate exception, also kept as a plain `<a>`:
 *   - It's a dynamic, non-static-params route that runs
 *     `materializePublicProfile` and schedules `after()` side effects.
 *     `next/link` prefetches by default (on hover/viewport-entry), so
 *     pointing one at this route would send speculative badge-pipeline
 *     traffic on every render of a navbar containing it (Studio's navbar
 *     links here).
 *   - Studio's own unsaved-changes protection (#1167 Wave 1) relies on the
 *     browser's native `beforeunload` event, which only fires for full
 *     document navigations — not `next/link`'s client-side routing. Keeping
 *     this one link a plain anchor preserves that guard without coupling
 *     this generic component to Studio's unsaved-changes state.
 */
export function NavLink({ href, label, className }: NavLinkProps) {
  const pathname = usePathname();
  const isCurrent = pathname === href;
  const ariaCurrentProps = isCurrent ? { "aria-current": "page" as const } : {};
  const children = (
    <>
      <span className="text-amber/50">/</span> {label.toLowerCase()}
    </>
  );

  const isInternalRoute = href.startsWith("/") && !href.startsWith("/u/");

  if (isInternalRoute) {
    return (
      <Link href={href} className={className} {...ariaCurrentProps}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} {...ariaCurrentProps}>
      {children}
    </a>
  );
}

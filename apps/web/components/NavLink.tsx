"use client";

import { usePathname } from "next/navigation";

interface NavLinkProps {
  href: string;
  label: string;
  className?: string;
}

/**
 * Client-side nav link that adds `aria-current="page"` when the href
 * matches the current pathname. Used inside the server-rendered Navbar.
 */
export function NavLink({ href, label, className }: NavLinkProps) {
  const pathname = usePathname();
  const isCurrent = pathname === href;

  return (
    <a
      href={href}
      className={className}
      {...(isCurrent ? { "aria-current": "page" as const } : {})}
    >
      <span className="text-amber/50">/</span> {label.toLowerCase()}
    </a>
  );
}

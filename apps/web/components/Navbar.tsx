import { headers } from "next/headers";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { isAdminHandle } from "@/lib/auth/admin";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";
import { NavbarShell } from "./NavbarShell";

interface NavLinkItem {
  label: string;
  href: string;
}

interface NavbarProps {
  navLinks?: NavLinkItem[];
  locale?: Locale;
}

/**
 * Server-side Navbar variant for non-ISR pages (`/studio`, `/admin`,
 * `/verify/[hash]`).
 *
 * Sources session via `headers()` (so it always knows session state
 * synchronously, no loading flash) and computes admin status via
 * `isAdminHandle()`. Rendering itself is delegated to `NavbarShell` so this
 * variant and `NavbarClient` never drift in markup (#1025).
 */
export async function Navbar({ navLinks, locale: localeOverride }: NavbarProps) {
  const h = await headers();
  const session = getOptionalServerSessionFromHeaders(h);
  const locale = await getServerLocale(localeOverride);
  const t = getServerT(locale);

  return (
    <NavbarShell
      navLinks={navLinks}
      session={session}
      isAdmin={session ? isAdminHandle(session.login) : false}
      t={t}
    />
  );
}

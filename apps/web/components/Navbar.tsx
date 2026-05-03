import Link from "next/link";
import { headers } from "next/headers";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { isAdminHandle } from "@/lib/auth/admin";
import { getServerLocale, getServerT } from "@/lib/i18n";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";

interface NavLinkItem {
  label: string;
  href: string;
}

interface NavbarProps {
  navLinks?: NavLinkItem[];
}

export async function Navbar({ navLinks }: NavbarProps) {
  const h = await headers();
  const session = getOptionalServerSessionFromHeaders(h);
  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    <nav aria-label={t('aria.mainNavigation') as string} className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg tracking-tight text-text-primary">
            Chapa<span className="text-amber animate-cursor-blink">_</span>
          </span>
        </Link>

        {/* Center: Command hints (desktop) */}
        {navLinks && navLinks.length > 0 && (
          <div className="hidden md:flex items-center gap-4 font-heading text-xs text-terminal-dim">
            {navLinks.map((link) => (
              <NavLink
                key={link.label}
                href={link.href}
                label={link.label}
                className="transition-colors hover:text-text-secondary"
              />
            ))}
          </div>
        )}

        {/* Mobile nav toggle */}
        {navLinks && navLinks.length > 0 && (
          <MobileNav links={navLinks} />
        )}

        {/* Right: Theme toggle + User or login */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {session ? (
            <UserMenu
              login={session.login}
              name={session.name}
              avatarUrl={session.avatar_url}
              isAdmin={isAdminHandle(session.login)}
            />
          ) : (
            <a
              href="/api/auth/login"
              className="font-heading text-sm text-terminal-dim transition-colors hover:text-amber"
            >
              <span className="text-amber/50">/</span> {t('common.login') as string}
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

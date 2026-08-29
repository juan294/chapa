import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface NavbarShellSessionUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface NavbarShellProps {
  navLinks?: NavLinkItem[];
  session: NavbarShellSessionUser | null;
  isAdmin: boolean;
  /**
   * True while the caller's session source is still resolving (only ever
   * relevant to the client `useSession()` variant — the server variant
   * always knows the session synchronously and never passes this).
   * Renders a neutral placeholder in the auth slot instead of jumping
   * straight to the logged-out UI, to avoid a login-link flash on ISR
   * pages (#1025 / FE-L2).
   */
  loading?: boolean;
  /**
   * Accepts either `getServerT` (server) or `useTranslation().t` (client) —
   * their return types differ slightly (server's is a superset), and every
   * call site here immediately casts with `as string`, so `unknown` is the
   * honest common type rather than re-declaring one side's shape.
   */
  t: (key: string) => unknown;
}

/**
 * Shared presentational markup for the site navbar.
 *
 * Rendered by both the server-side `Navbar` (session sourced via
 * `headers()`, used on non-ISR pages) and the client-side `NavbarClient`
 * (session sourced via the `useSession()` hook, used on the 9 ISR pages).
 * Centralizing the markup here means a nav change is made once, and the
 * admin-only affordance is driven by a single `isAdmin` prop rather than
 * two independently-computed values.
 *
 * This component intentionally does NOT decide HOW to source session or
 * locale data — that split is preserved in the two wrapper components
 * because it's what allows the ISR pages to stay statically cacheable.
 */
export function NavbarShell({ navLinks, session, isAdmin, loading = false, t }: NavbarShellProps) {
  return (
    <nav aria-label={t('aria.mainNavigation') as string} className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg tracking-tight text-text-primary">
            Chapa<span className="text-amber-dark animate-cursor-blink">_</span>
          </span>
        </Link>

        {/* Center: Command hints (desktop) */}
        {navLinks && navLinks.length > 0 && (
          <div className="hidden md:flex items-center gap-1 font-heading text-xs text-text-secondary">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                // #1214 — 44px hit area, and a tinted pill on hover so the
                // target is visible before it is clicked.
                className="flex min-h-[44px] items-center rounded-lg px-3 transition-colors hover:bg-purple-tint hover:text-text-primary"
              />
            ))}
          </div>
        )}

        {/* Mobile nav toggle */}
        {navLinks && navLinks.length > 0 && (
          <MobileNav links={navLinks} />
        )}

        {/* Right: Language switcher + Theme toggle + User or login */}
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <div suppressHydrationWarning>
            {loading ? (
              <div
                data-testid="navbar-auth-placeholder"
                aria-hidden="true"
                className="h-8 w-20 rounded-lg bg-track"
              />
            ) : session ? (
              <UserMenu
                login={session.login}
                name={session.name}
                avatarUrl={session.avatar_url}
                isAdmin={isAdmin}
              />
            ) : (
              // Intentional native <a> for a server-redirect API route
              // (GitHub OAuth), not a client-side page navigation. The
              // #1023 top-level app/[locale] dynamic segment makes this
              // lint rule's page-path heuristic false-positive on any
              // /api/* href.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a
                href="/api/auth/login"
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 font-heading text-sm text-text-secondary transition-colors hover:bg-purple-tint hover:text-text-primary"
              >
                <span className="text-amber/50">/</span> {t('common.login') as string}
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

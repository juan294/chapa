import Link from "next/link";
import { headers } from "next/headers";
import { readSessionCookie } from "@/lib/auth/github";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";

interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  navLinks?: NavLink[];
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export async function Navbar({ navLinks }: NavbarProps) {
  // Read session from cookie
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let session: { login: string; name: string | null; avatar_url: string } | null = null;

  if (sessionSecret) {
    const headerStore = await headers();
    const parsed = readSessionCookie(headerStore.get("cookie"), sessionSecret);
    if (parsed) {
      session = {
        login: parsed.login,
        name: parsed.name,
        avatar_url: parsed.avatar_url,
      };
    }
  }

  return (
    <nav aria-label="Main navigation" className="fixed top-0 z-50 w-full border-b border-stroke bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold font-heading tracking-tight text-text-primary">
            Chapa<span className="text-amber">.</span>
          </span>
        </Link>

        {navLinks && navLinks.length > 0 && (
          <div className="hidden md:flex items-center gap-1 rounded-full border border-stroke bg-card/60 px-1.5 py-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full px-4 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary hover:bg-amber/[0.06]"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}

        {navLinks && navLinks.length > 0 && (
          <MobileNav links={navLinks} />
        )}

        {session ? (
          <UserMenu
            login={session.login}
            name={session.name}
            avatarUrl={session.avatar_url}
          />
        ) : (
          <a
            href="/api/auth/login"
            className="flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-lg hover:shadow-amber/20"
          >
            <GitHubIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Get Your Badge</span>
            <span className="sm:hidden">Sign in</span>
          </a>
        )}
      </div>
    </nav>
  );
}

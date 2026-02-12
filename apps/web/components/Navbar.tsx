import Link from "next/link";
import { headers } from "next/headers";
import { readSessionCookie } from "@/lib/auth/github";
import { UserMenu } from "./UserMenu";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { KbdHint } from "./KbdHint";

interface NavLink {
  label: string;
  href: string;
}

interface NavbarProps {
  navLinks?: NavLink[];
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
    <nav aria-label="Main navigation" className="fixed top-0 z-50 w-full border-b border-stroke bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-lg tracking-tight text-text-primary">
            Chapa<span className="text-amber animate-cursor-blink">_</span>
          </span>
        </Link>

        {/* Center: Command hints (desktop) */}
        {navLinks && navLinks.length > 0 ? (
          <div className="hidden md:flex items-center gap-4 font-heading text-xs text-terminal-dim">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-text-secondary"
              >
                <span className="text-amber/50">/</span> {link.label.toLowerCase()}
              </a>
            ))}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-3 font-heading text-xs text-terminal-dim">
            <Link href="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-text-secondary">
              <span className="text-amber/50">/</span> home
              <KbdHint keys={["⌘", "1"]} />
            </Link>
            <Link href={session ? `/u/${session.login}` : "/"} className="inline-flex items-center gap-1.5 transition-colors hover:text-text-secondary">
              <span className="text-amber/50">/</span> profile
              <KbdHint keys={["⌘", "2"]} />
            </Link>
            <Link href="/studio" className="inline-flex items-center gap-1.5 transition-colors hover:text-text-secondary">
              <span className="text-amber/50">/</span> studio
              <KbdHint keys={["⌘", "3"]} />
            </Link>
          </div>
        )}

        {/* Mobile nav toggle */}
        {navLinks && navLinks.length > 0 && (
          <MobileNav links={navLinks} />
        )}

        {/* Right: Theme toggle + User or login */}
        <div className="flex items-center gap-2">
          <KbdHint keys={["?"]} className="mr-1" />
          <ThemeToggle />
          {session ? (
            <UserMenu
              login={session.login}
              name={session.name}
              avatarUrl={session.avatar_url}
            />
          ) : (
            <a
              href="/api/auth/login"
              className="font-heading text-sm text-terminal-dim transition-colors hover:text-amber"
            >
              <span className="text-amber/50">/</span> login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

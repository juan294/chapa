import Link from "next/link";
import { LoginCtaButton } from "@/components/LoginCtaButton";
import { ClaudeCodeStar } from "@/components/ClaudeCodeStar";
import {
  GitHubIcon,
  BitbucketIcon,
  CodebergIcon,
  GitlabIcon,
} from "@/components/icons";

type TFunction = (key: string) => unknown;

export interface SiteFooterProps {
  /**
   * Accepts either `getServerT` (server) or `useTranslation().t` (client) —
   * every call site here immediately casts with `as string`, so `unknown`
   * is the honest common return type rather than re-declaring one side's
   * shape (mirrors NavbarShellProps.t).
   */
  t: TFunction;
  /**
   * Renders a compact "get your badge" CTA above the footer links. The
   * landing page already has several primary CTAs throughout its body, so
   * this defaults to false there; content pages that otherwise dead-end
   * (About, the 7 archetype guides) pass `showCta` so a visitor always has
   * a path back to conversion (#1167 / UX-B1).
   */
  showCta?: boolean;
}

/**
 * Site-wide footer: Privacy/Terms/About/Scoring links, platform
 * attribution, and copyright.
 *
 * Extracted from LandingContent (#1167 / UX-B1, launch blocker) — before
 * this, LandingContent.tsx was the ONLY call site rendering a `<footer>` in
 * the whole app, so Privacy and Terms were reachable exclusively from the
 * home page. `/about`, all 7 `/archetypes/*` pages, `/privacy`, and
 * `/terms` itself rendered nothing after their main content.
 *
 * Deliberately a plain function component (no "use client"): every call
 * site passes an already-resolved `t` (getServerT(locale) on the
 * server-rendered [locale] pages, or the client useTranslation() hook's `t`
 * elsewhere), so rendering this from a `force-static` page never forces
 * per-request cookies()/headers() reads and doesn't threaten the #1023 ISR
 * contract. ClaudeCodeStar is a small "use client" leaf (its cycling-glyph
 * animation needs useEffect) — Server Components can render Client
 * Components directly, the same pattern LandingContent already relied on
 * for its own footer before this extraction.
 */
export function SiteFooter({ t, showCta = false }: SiteFooterProps) {
  const tagline = t('landing.footer.tagline') as string;
  const poweredBy = t('landing.footer.poweredBy') as string;
  const about = t('landing.footer.about') as string;
  const scoring = t('landing.footer.scoring') as string;
  const terms = t('landing.footer.terms') as string;
  const privacy = t('landing.footer.privacy') as string;

  return (
    <footer className="border-t border-stroke py-8">
      <div className="mx-auto max-w-7xl px-6">
        {showCta && (
          <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-stroke bg-card px-6 py-5">
            <p className="text-sm text-text-secondary">
              {t('landing.finalCta.prompt') as string}
            </p>
            <LoginCtaButton
              label={t('landing.finalCta.button') as string}
              pendingLabel={t('landing.finalCta.buttonPending') as string}
              size="sm"
            />
          </div>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-heading text-sm tracking-tight text-text-primary">
              Chapa<span className="text-amber">_</span>
            </span>
            <span className="text-xs text-text-secondary">{tagline}</span>
          </div>

          <div className="flex items-center gap-3 text-text-secondary">
            <span className="text-xs">{poweredBy}</span>
            <div className="flex items-center gap-2.5">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="hover:text-amber transition-colors">
                <GitHubIcon className="w-3.5 h-3.5" />
              </a>
              <a href="https://bitbucket.org" target="_blank" rel="noopener noreferrer" aria-label="Bitbucket" title="Bitbucket" className="hover:text-amber transition-colors">
                <BitbucketIcon className="w-3.5 h-3.5" />
              </a>
              <a href="https://codeberg.org" target="_blank" rel="noopener noreferrer" aria-label="Codeberg" title="Codeberg" className="hover:text-amber transition-colors">
                <CodebergIcon className="w-3.5 h-3.5" />
              </a>
              <a href="https://gitlab.com" target="_blank" rel="noopener noreferrer" aria-label="GitLab" title="GitLab" className="hover:text-amber transition-colors">
                <GitlabIcon className="w-3.5 h-3.5" />
              </a>
              <a href="https://claude.ai/code" target="_blank" rel="noopener noreferrer" aria-label="Claude Code" title="Claude Code" className="font-heading text-xs leading-none hover:text-amber transition-colors">
                <ClaudeCodeStar />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <Link href="/about" className="hover:text-amber transition-colors">{about}</Link>
            <Link href="/about/scoring" className="hover:text-amber transition-colors">{scoring}</Link>
            <Link href="/terms" className="hover:text-amber transition-colors">{terms}</Link>
            <Link href="/privacy" className="hover:text-amber transition-colors">{privacy}</Link>
          </div>
        </div>

        <div suppressHydrationWarning className="mt-6 text-center text-xs text-text-secondary">
          &copy; {new Date().getFullYear()} Chapa
        </div>
      </div>
    </footer>
  );
}

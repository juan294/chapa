import { BadgeOverlay } from "@/components/BadgeOverlay";
import { CopyButton } from "@/components/CopyButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { NavbarClient } from "@/components/NavbarClient";
import { LocaleSync } from "@/lib/i18n";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingTerminal } from "./LandingTerminal";
import { LoginCtaButton } from "@/components/LoginCtaButton";
import { ClaudeCodeStar } from "@/components/ClaudeCodeStar";
import {
  GitHubIcon,
  BitbucketIcon,
  CodebergIcon,
  GitlabIcon,
} from "@/components/icons";
import Link from "next/link";

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeBranding: true,
  demoMode: true,
});


function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
    </svg>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { error, lang } = await searchParams;
  const errorMessage = getOAuthErrorMessage(error);
  // Detect locale from cookie → ?lang= → Accept-Language → 'es' default.
  // The page is dynamic so the server always renders in the user's actual locale,
  // and router.refresh() after setLocale() delivers the correct language immediately.
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);

  const navLinks = t('landing.navLinks') as unknown as Array<{ label: string; href: string }>;

  const hero = t('landing.hero') as unknown as Record<string, string | string[]>;
  const heroTitle = hero.title as string;
  const heroHighlight = hero.highlight as string;
  const heroLeadBefore = hero.leadBefore as string;
  const heroLeadQuantify = hero.leadQuantify as string;
  const heroLeadMiddle = hero.leadMiddle as string;
  const heroLeadImpact = hero.leadImpact as string;
  const heroLeadAfter = hero.leadAfter as string;
  const heroBullets = hero.bullets as string[];
  const heroPrimaryCta = hero.primaryCta as string;
  const heroPrimaryCtaPending = hero.primaryCtaPending as string;
  const heroVerifyCta = hero.verifyCta as string;
  const heroBadgePreviewLabel = hero.badgePreviewLabel as string;

  const embed = t('landing.embed') as unknown as Record<string, string>;
  const sections = t('landing.sections') as unknown as Record<string, string>;
  const features = t('landing.features') as unknown as Array<{ title: string; description?: string; descriptionBefore?: string; descriptionAfter?: string }>;
  const archetypes = t('landing.archetypes') as unknown as Record<string, string>;
  const steps = t('landing.steps') as unknown as Array<{ number: string; title: string; description: string }>;
  const measure = t('landing.measure') as unknown as Record<string, string>;
  const dimensions = t('landing.dimensions') as unknown as Array<{ title: string; description: string }>;
  const enterprise = t('landing.enterprise') as unknown as Record<string, string>;
  const stats = t('landing.stats') as unknown as Array<{ value: string; label: string }>;
  const finalCta = t('landing.finalCta') as unknown as Record<string, string>;
  const footer = t('landing.footer') as unknown as Record<string, string>;

  return (
    <div className="bg-bg min-h-screen text-text-primary">
      <LocaleSync queryLang={lang} />
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <NavbarClient navLinks={navLinks} />

      <main id="main-content">
        {/* ── Terminal session ─────────────────────────────── */}
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-20 md:pt-28 md:pb-32 space-y-16 md:space-y-24">

          {/* ── Hero: $ chapa ──────────────────────────────── */}
          <section className="animate-fade-in-up motion-reduce:animate-none">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-4">
              <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl tracking-tight leading-[0.95] text-balance">
                {heroTitle}
                <br />
                <span className="text-amber">{heroHighlight}</span>
              </h1>
              <div className="space-y-2 font-heading text-text-secondary">
                <p className="text-base text-text-primary font-medium text-pretty"><span className="text-amber select-none">&gt;</span> {heroLeadBefore} <span className="bg-amber/10 px-1 rounded">{heroLeadQuantify}</span> {heroLeadMiddle} <span className="bg-amber/10 px-1 rounded">{heroLeadImpact}</span> {heroLeadAfter}</p>
                <div className="pl-5 space-y-1 text-sm">
                  {heroBullets.map((bullet) => (
                    <p key={bullet}><span className="text-terminal-dim select-none">&gt;</span> {bullet}</p>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <LoginCtaButton
                  label={heroPrimaryCta}
                  pendingLabel={heroPrimaryCtaPending}
                  size="sm"
                />
                <Link
                  href="/verify"
                  className="group inline-flex items-center gap-2.5 rounded-lg bg-complement pl-6 pr-5 py-3 text-sm font-semibold text-white transition-all hover:bg-complement/80 hover:shadow-xl hover:shadow-complement/25"
                >
                  <ShieldCheckIcon className="w-4 h-4" />
                  {heroVerifyCta}
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── Badge Preview: $ chapa preview @developer ──── */}
          <section id="badge-preview" className="relative z-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:200ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa preview @developer</span>
            </div>
            <div className="pl-4 border-l border-stroke">
              <div className="relative">
                {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded demo data (DEMO_STATS, DEMO_IMPACT) — no user input reaches this point. See lib/render/escape.ts for escaping. */}
                <div
                  className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
                  role="img"
                  aria-label={heroBadgePreviewLabel}
                  dangerouslySetInnerHTML={{ __html: demoBadgeSvg }}
                />
                <BadgeOverlay />
              </div>
            </div>
          </section>

          {/* ── Embed: $ chapa embed ──────────────────────── */}
          <section className="animate-fade-in-up motion-reduce:animate-none [animation-delay:400ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa embed</span>
            </div>
            <div className="pl-4 border-l border-stroke">
              <div className="rounded-xl border border-stroke bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
                  <span className="ml-2 text-xs text-terminal-dim font-heading">
                    {embed.windowLabel}
                  </span>
                  <div className="ml-auto">
                    <CopyButton text={`![${embed.altText}](https://chapa.thecreativetoken.com/u/developer/badge.svg)`} />
                  </div>
                </div>
                <div className="p-4 font-heading text-sm leading-relaxed">
                  <p className="text-terminal-dim">
                    <span className="text-amber/50">{"<!-- "}</span>
                    {embed.comment}
                    <span className="text-amber/50">{" -->"}</span>
                  </p>
                  <p className="text-text-primary/80 mt-1">
                    <span className="text-amber">{`![${embed.altText}](`}</span>
                    <span className="text-text-secondary">
                      {"chapa.thecreativetoken.com/u/"}
                    </span>
                    <span className="text-amber/70">{"developer"}</span>
                    <span className="text-amber">{"/badge.svg)"}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Features: $ chapa features ────────────────── */}
          <section id="features" className="animate-fade-in-up motion-reduce:animate-none [animation-delay:600ms]">
            <h2 className="font-heading text-xs tracking-widest uppercase text-text-secondary mb-3">{sections.features}</h2>
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa features</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-4">
              {features.map((feature) => (
                <div key={feature.title} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-48">
                    {feature.title}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {"description" in feature ? (
                      feature.description
                    ) : (
                      <>
                        {feature.descriptionBefore} —{" "}
                        <Link href="/archetypes/builder" className="font-semibold text-archetype-builder hover:text-amber-light transition-colors">{archetypes.builder}</Link>,{" "}
                        <Link href="/archetypes/guardian" className="font-semibold text-archetype-guardian hover:text-archetype-guardian/70 transition-colors">{archetypes.guardian}</Link>,{" "}
                        <Link href="/archetypes/marathoner" className="font-semibold text-archetype-marathoner hover:text-archetype-marathoner/70 transition-colors">{archetypes.marathoner}</Link>,{" "}
                        <Link href="/archetypes/polymath" className="font-semibold text-archetype-polymath hover:text-archetype-polymath/70 transition-colors">{archetypes.polymath}</Link>,{" "}
                        <Link href="/archetypes/artificer" className="font-semibold text-archetype-artificer hover:text-archetype-artificer/70 transition-colors">{archetypes.artificer}</Link>,{" "}
                        <Link href="/archetypes/balanced" className="font-semibold text-archetype-balanced hover:text-text-primary transition-colors">{archetypes.balanced}</Link> {t('common.orConnector') as string}{" "}
                        <Link href="/archetypes/emerging" className="font-semibold text-archetype-emerging hover:text-text-secondary transition-colors">{archetypes.emerging}</Link> — {feature.descriptionAfter}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Cómo funciona: $ chapa explain ─────────────── */}
          <section id="how-it-works" className="animate-fade-in-up motion-reduce:animate-none [animation-delay:800ms]">
            <h2 className="font-heading text-xs tracking-widest uppercase text-text-secondary mb-3">{sections.howItWorks}</h2>
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa explain</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-6">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-4 items-start">
                  <span className="font-heading text-amber text-lg shrink-0">
                    {step.number}
                  </span>
                  <div>
                    <p className="font-heading text-text-primary text-sm font-medium">
                      {step.title}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}

              <div className="pt-4 space-y-4">
                <h3 className="font-heading text-sm text-text-primary font-medium">
                  {measure.title}
                </h3>
                <p className="text-text-secondary text-sm text-pretty">
                  {measure.descriptionBefore}{" "}
                  <Link href="/archetypes/builder" className="font-semibold text-archetype-builder hover:text-amber-light transition-colors">{archetypes.builder}</Link>,{" "}
                  <Link href="/archetypes/guardian" className="font-semibold text-archetype-guardian hover:text-archetype-guardian/70 transition-colors">{archetypes.guardian}</Link>,{" "}
                  <Link href="/archetypes/marathoner" className="font-semibold text-archetype-marathoner hover:text-archetype-marathoner/70 transition-colors">{archetypes.marathoner}</Link>,{" "}
                  <Link href="/archetypes/polymath" className="font-semibold text-archetype-polymath hover:text-archetype-polymath/70 transition-colors">{archetypes.polymath}</Link>,{" "}
                  <Link href="/archetypes/artificer" className="font-semibold text-archetype-artificer hover:text-archetype-artificer/70 transition-colors">{archetypes.artificer}</Link>,{" "}
                  <Link href="/archetypes/balanced" className="font-semibold text-archetype-balanced hover:text-text-primary transition-colors">{archetypes.balanced}</Link> {t('common.orConnector') as string}{" "}
                  <Link href="/archetypes/emerging" className="font-semibold text-archetype-emerging hover:text-text-secondary transition-colors">{archetypes.emerging}</Link>.
                </p>
                {dimensions.map((dim) => (
                  <div key={dim.title} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                    <span className="text-amber font-heading text-sm shrink-0 sm:w-48">
                      {dim.title}
                    </span>
                    <span className="text-text-secondary text-sm">
                      {dim.description}
                    </span>
                  </div>
                ))}
                <Link
                  href="/about/scoring"
                  className="inline-flex items-center gap-1 text-sm text-amber hover:text-amber-light transition-colors font-heading"
                >
                  {measure.methodologyLink}
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── Enterprise: $ chapa enterprise ────────────── */}
          <section id="enterprise" className="animate-fade-in-up motion-reduce:animate-none [animation-delay:900ms]">
            <h2 className="font-heading text-xs tracking-widest uppercase text-text-secondary mb-3">{sections.enterprise}</h2>
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa enterprise</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-5">
              <div>
                <h3 className="font-heading text-lg tracking-tight text-text-primary">
                  {enterprise.title} <span className="text-amber">{enterprise.highlight}</span>
                </h3>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl text-pretty">
                  {enterprise.description}
                </p>
              </div>

              <div className="rounded-xl border border-stroke bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
                  <span className="ml-2 text-xs text-terminal-dim font-heading">
                    terminal
                  </span>
                </div>
                <div className="p-4 font-heading text-sm leading-relaxed space-y-1">
                  <p>
                    <span className="text-terminal-dim select-none">$ </span>
                    <span className="text-text-primary/80">npx chapa-cli</span>
                  </p>
                  <p className="text-terminal-green">
                    <span className="text-terminal-dim select-none">&gt; </span>
                    {enterprise.terminalAuthenticated}
                  </p>
                  <p className="text-terminal-green">
                    <span className="text-terminal-dim select-none">&gt; </span>
                    {enterprise.terminalFound}
                  </p>
                  <p className="text-terminal-green">
                    <span className="text-terminal-dim select-none">&gt; </span>
                    {enterprise.terminalMerged}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">
                  <span className="text-dimension-delivery font-heading text-sm shrink-0 sm:w-48">
                    {enterprise.whatItDoes}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {enterprise.whatItDoesText}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">
                  <span className="text-dimension-consistency font-heading text-sm shrink-0 sm:w-48">
                    {enterprise.howToUse}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {enterprise.howToUseTextBefore}{" "}
                    <code className="font-heading text-text-primary/80 bg-amber/10 px-1.5 py-0.5 rounded text-xs">
                      npx chapa-cli
                    </code>{" "}
                    {enterprise.howToUseTextAfter}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">
                  <span className="text-dimension-breadth font-heading text-sm shrink-0 sm:w-48">
                    {enterprise.noEmu}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {enterprise.noEmuText}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Stats: $ chapa stats ──────────────────────── */}
          <section id="stats" className="animate-fade-in-up motion-reduce:animate-none [animation-delay:1100ms]">
            <h2 className="font-heading text-xs tracking-widest uppercase text-text-secondary mb-3">{sections.stats}</h2>
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa stats</span>
            </div>
            <div className="pl-4 border-l border-stroke">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-4 font-heading text-sm">
                {stats.map((stat, i) => (
                  <span key={stat.label} className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl tracking-tight text-amber tabular-nums">
                      {stat.value}
                    </span>
                    <span className="text-text-secondary">{stat.label}</span>
                    {i < stats.length - 1 && (
                      <span className="text-terminal-dim ml-4">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA: $ chapa login ────────────────────────── */}
          <section className="animate-fade-in-up motion-reduce:animate-none [animation-delay:1300ms]">
            <h2 className="font-heading text-xs tracking-widest uppercase text-text-secondary mb-3">{sections.getStarted}</h2>
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa login</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-6">
              <p className="text-text-secondary text-sm">
                {finalCta.prompt}
              </p>
              <LoginCtaButton
                label={finalCta.button as string}
                pendingLabel={finalCta.buttonPending as string}
                size="lg"
              />
            </div>
          </section>
        </div>

        {/* ── Persistent terminal input ───────────────────── */}
        <LandingTerminal />
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-stroke py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-heading text-sm tracking-tight text-text-primary">
                Chapa<span className="text-amber">_</span>
              </span>
              <span className="text-xs text-text-secondary">
                {footer.tagline}
              </span>
            </div>

            <div className="flex items-center gap-3 text-text-secondary">
              <span className="text-xs">{footer.poweredBy}</span>
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
              <Link href="/about" className="hover:text-amber transition-colors">{footer.about}</Link>
              <Link href="/about/scoring" className="hover:text-amber transition-colors">{footer.scoring}</Link>
              <Link href="/terms" className="hover:text-amber transition-colors">{footer.terms}</Link>
              <Link href="/privacy" className="hover:text-amber transition-colors">{footer.privacy}</Link>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-terminal-dim">
            &copy; {new Date().getFullYear()} Chapa
          </div>
        </div>
      </footer>
    </div>
  );
}

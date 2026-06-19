export const revalidate = 3600;
export const dynamic = 'force-static';

import { BadgeOverlay } from "@/components/BadgeOverlay";
import { CopyButton } from "@/components/CopyButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { NavbarClient } from "@/components/NavbarClient";
import { LocaleSync } from "@/lib/i18n";
import { getServerT } from "@/lib/i18n/server";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingTerminal } from "./LandingTerminal";
import { ClaudeCodeStar } from "@/components/ClaudeCodeStar";
import Link from "next/link";

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

/* ── Icons ─────────────────────────────────────────────────────── */

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}

function CodebergIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z" />
    </svg>
  );
}

function GitlabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m23.6004 9.5927-.0337-.0862L20.3.9814a.851.851 0 0 0-.3362-.405.8748.8748 0 0 0-.9997.0539.8748.8748 0 0 0-.29.4399l-2.2055 6.748H7.5375l-2.2057-6.748a.8573.8573 0 0 0-.29-.4412.8748.8748 0 0 0-.9997-.0539.8585.8585 0 0 0-.3362.405L.4332 9.5065l-.0325.0862a6.0657 6.0657 0 0 0 2.0119 7.0105l.0113.0087.0301.0213 4.976 3.7264 2.462 1.8633 1.4995 1.1321a1.0085 1.0085 0 0 0 1.2197 0l1.4995-1.1321 2.462-1.8633 5.006-3.7489.0125-.01a6.0682 6.0682 0 0 0 2.0094-7.003z" />
    </svg>
  );
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
  // Render at DEFAULT_LOCALE (es) at build time; client LocaleSync swaps to
  // the user's cookie locale on hydration — same pattern as the share page.
  const t = getServerT(DEFAULT_LOCALE);

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
                <a
                  href="/api/auth/login"
                  className="group inline-flex items-center gap-2.5 rounded-lg bg-amber pl-6 pr-5 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
                >
                  <GitHubIcon className="w-4 h-4" />
                  {heroPrimaryCta}
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
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
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-48">
                    {enterprise.whatItDoes}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {enterprise.whatItDoesText}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-48">
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
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-48">
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
              <a
                href="/api/auth/login"
                className="group inline-flex items-center gap-2.5 rounded-lg bg-amber pl-8 pr-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
              >
                <GitHubIcon className="w-5 h-5" />
                {finalCta.button}
                <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
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

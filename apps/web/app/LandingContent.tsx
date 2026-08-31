import Link from "next/link";
import type { ImpactV6Result } from "@chapa/shared";
import { BadgeOverlay } from "@/components/BadgeOverlay";
import { CopyButton } from "@/components/CopyButton";
import { NavbarClient } from "@/components/NavbarClient";
import { SectionHeader } from "@/components/SectionHeader";
import { tArray, tObject } from "@/lib/i18n/typed-accessors";
import { interpolate } from "@/lib/i18n/interpolate";
import { LandingUrlEffects } from "./LandingUrlEffects";
import { LandingTerminal } from "./LandingTerminal";
import { LoginCtaButton } from "@/components/LoginCtaButton";
import { SiteFooter } from "@/components/SiteFooter";

type TFunction = (key: string) => unknown;

/** Meter colors, in the order the scoring section lists the dimensions. */
const DIMENSION_STYLES = [
  { key: "delivery", bar: "bg-dimension-delivery" },
  { key: "quality", bar: "bg-dimension-quality" },
  { key: "consistency", bar: "bg-dimension-consistency" },
  { key: "breadth", bar: "bg-dimension-breadth" },
  { key: "craft", bar: "bg-dimension-craft" },
] as const;

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

/**
 * Splits a hero bullet on `**keyword**` markers into text and bolded nodes
 * (#1240). Bold-only, no markdown lib: translators mark emphasis per locale
 * without needing the same substring to exist across languages (the
 * structured-bullets alternative would break on that).
 */
function renderBoldedBullet(text: string) {
  return text.split(/(\*\*.+?\*\*)/g).map((part, index) => {
    const match = /^\*\*(.+)\*\*$/.exec(part);
    return match ? (
      <strong key={index} className="font-semibold">
        {match[1]}
      </strong>
    ) : (
      part
    );
  });
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

/** The seven archetype names, linked to their guide pages. */
function ArchetypeLinks({
  archetypes,
  orConnector,
}: {
  archetypes: Record<string, string>;
  orConnector: string;
}) {
  return (
    <>
      <Link href="/archetypes/builder" className="font-semibold text-archetype-builder hover:text-amber-light transition-colors">{archetypes.builder}</Link>,{" "}
      <Link href="/archetypes/guardian" className="font-semibold text-archetype-guardian hover:text-archetype-guardian/70 transition-colors">{archetypes.guardian}</Link>,{" "}
      <Link href="/archetypes/marathoner" className="font-semibold text-archetype-marathoner hover:text-archetype-marathoner/70 transition-colors">{archetypes.marathoner}</Link>,{" "}
      <Link href="/archetypes/polymath" className="font-semibold text-archetype-polymath hover:text-archetype-polymath/70 transition-colors">{archetypes.polymath}</Link>,{" "}
      <Link href="/archetypes/artificer" className="font-semibold text-archetype-artificer hover:text-archetype-artificer/70 transition-colors">{archetypes.artificer}</Link>,{" "}
      <Link href="/archetypes/balanced" className="font-semibold text-archetype-balanced hover:text-text-primary transition-colors">{archetypes.balanced}</Link> {orConnector}{" "}
      <Link href="/archetypes/emerging" className="font-semibold text-archetype-emerging hover:text-text-secondary transition-colors">{archetypes.emerging}</Link>
    </>
  );
}

/* ── Page body ─────────────────────────────────────────────────── */

/**
 * Server-rendered landing page body (#1023 / FE-H1). `t` is
 * `getServerT(locale)` (the same `(key: string) => ...` shape as the client
 * translation hook's `t`, per `typed-accessors.ts`), resolved from the route's
 * `[locale]` segment param — both locale variants are statically
 * pre-rendered (see `app/[locale]/layout.tsx`), so there is no client-side
 * re-render/flash. The one genuinely-interactive piece (the `?lang=`/`error`
 * query-param handling that must stay client-side to preserve #982's
 * static/ISR contract) is isolated in the `LandingUrlEffects` client leaf.
 *
 * #1215 restructured the page around a theme-aware hero band with the badge
 * panel overlapping its lower edge, and moved every section onto the shared
 * `SectionHeader` pattern. Type sizes come from `clamp(min, Ncqi, max)` inside
 * `@container` wrappers, so one layout serves desktop and 390px with no
 * breakpoint.
 */
export function LandingContent({
  demoBadgeSvg,
  demoImpact,
  t,
}: {
  demoBadgeSvg: string;
  demoImpact: ImpactV6Result;
  t: TFunction;
}) {
  const navLinks = tArray<{ label: string; href: string }>(t, 'landing.navLinks');

  const hero = tObject<Record<string, string | string[]>>(t, 'landing.hero');
  const heroTitle = hero.title as string;
  const heroHighlight = hero.highlight as string;
  const heroBullets = tArray<string>(t, 'landing.hero.bullets');
  const heroPrimaryCta = hero.primaryCta as string;
  const heroPrimaryCtaPending = hero.primaryCtaPending as string;
  const heroVerifyCta = hero.verifyCta as string;
  const heroBadgePreviewLabel = hero.badgePreviewLabel as string;

  const embed = tObject<Record<string, string>>(t, 'landing.embed');
  const sections = tObject<Record<string, string>>(t, 'landing.sections');
  const sectionMeta = tObject<Record<string, string>>(t, 'landing.sectionMeta');
  const features = tArray<{ title: string; description?: string; descriptionBefore?: string; descriptionAfter?: string }>(t, 'landing.features');
  const archetypes = tObject<Record<string, string>>(t, 'landing.archetypes');
  const steps = tArray<{ number: string; title: string; description: string }>(t, 'landing.steps');
  const measure = tObject<Record<string, string>>(t, 'landing.measure');
  const dimensions = tArray<{ title: string; description: string }>(t, 'landing.dimensions');
  const enterprise = tObject<Record<string, string>>(t, 'landing.enterprise');
  const stats = tArray<{ value: string; label: string }>(t, 'landing.stats');
  const orConnector = t('common.orConnector') as string;
  const tierLabel = t(`tiers.${demoImpact.tier.toLowerCase()}`) as string;
  const embedSnippet = `![${embed.altText}](https://chapa.thecreativetoken.com/u/developer/badge.svg)`;

  return (
    <div className="bg-bg min-h-screen text-text-primary">
      <LandingUrlEffects />
      <NavbarClient navLinks={navLinks} />

      <main id="main-content">
        {/* ── Hero band ────────────────────────────────────────
            Theme aware: mint in light, forest in dark. An always-dark hero
            turned light mode into a strip around a dark slab. */}
        <section className="bg-hero-band bg-grid-warm border-b border-stroke pt-28 pb-44 md:pt-32">
          <div className="@container mx-auto max-w-5xl px-6">
            <div className="flex items-center gap-2 font-heading text-xs text-terminal-dim">
              <span>chapa@web</span>
              <span className="select-none">~ %</span>
              <span className="text-text-secondary">chapa</span>
              <span className="animate-cursor-blink text-amber select-none">_</span>
            </div>
            <h1 className="mt-6 font-heading text-[clamp(2.25rem,8cqi,4.5rem)] leading-[0.95] tracking-tight text-balance">
              {heroTitle}
              <br />
              <span className="text-amber">{heroHighlight}</span>
            </h1>
            <div className="mt-6 flex flex-col gap-2.5">
              {heroBullets.map((bullet) => (
                <p
                  key={bullet}
                  className="flex gap-2.5 text-[clamp(0.9rem,1.6cqi,1.0625rem)] text-text-secondary text-pretty"
                >
                  <span className="shrink-0 text-terminal-green" aria-hidden="true">▸</span>
                  <span>{renderBoldedBullet(bullet)}</span>
                </p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LoginCtaButton
                label={heroPrimaryCta}
                pendingLabel={heroPrimaryCtaPending}
                size="lg"
              />
              <Link
                href="/verify"
                className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-lg border border-complement pl-6 pr-5 text-sm font-semibold text-complement-text transition-colors hover:text-complement-text-hover"
              >
                <ShieldCheckIcon className="w-4 h-4" />
                {heroVerifyCta}
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((stat) => (
                <div key={stat.label} className="border-t border-stroke-strong pt-2">
                  <dd className="font-heading text-3xl tabular-nums tracking-tight text-text-primary">
                    {stat.value}
                  </dd>
                  <dt className="font-heading text-xs text-terminal-dim">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Badge preview: overlaps the band's lower edge ───── */}
        <section id="badge-preview" className="relative z-10 -mt-32">
          <div className="mx-auto max-w-5xl px-6">
            <SectionHeader
              command="chapa preview @developer"
              meta={sectionMeta.preview}
            />
            {/* The badge carries its own dark ground and rounded corners, so it
                needs no frame here — it renders exactly as in a README embed. */}
            <div className="relative mx-auto w-full max-w-[1200px]">
              {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded demo data (DEMO_STATS, DEMO_IMPACT) — no user input reaches this point. See lib/render/escape.ts for escaping. */}
              <div
                className="drop-shadow-2xl [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={heroBadgePreviewLabel}
                dangerouslySetInnerHTML={{ __html: demoBadgeSvg }}
              />
              <BadgeOverlay />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-6 pt-20 pb-24 space-y-20">
          {/* ── Features ─────────────────────────────────────── */}
          <section id="features">
            <SectionHeader
              command="chapa features"
              title={sections.features}
              meta={
                <>
                  <span className="text-terminal-green">&#10003;</span>{" "}
                  {interpolate(sectionMeta.features!, { count: String(features.length) })}
                </>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  // min-w-0: a grid item defaults to min-width:auto, so the
                  // embed snippet's content width would set the track width and
                  // push the whole page wider than a phone screen (#1224).
                  className={`min-w-0 rounded-xl border border-stroke bg-card p-5 ${
                    index === features.length - 1 ? "sm:col-span-2" : ""
                  }`}
                >
                  <h3 className="font-heading text-sm lowercase text-amber">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-pretty text-text-secondary">
                    {"description" in feature ? (
                      feature.description
                    ) : (
                      <>
                        {feature.descriptionBefore} —{" "}
                        <ArchetypeLinks archetypes={archetypes} orConnector={orConnector} />{" "}
                        — {feature.descriptionAfter}
                      </>
                    )}
                  </p>
                  {index === features.length - 1 && (
                    <div className="mt-4 flex items-center gap-3 overflow-hidden rounded-lg border border-stroke bg-bg px-3 py-2">
                      {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto,
                          so without it overflow-x-auto never engages, the snippet
                          holds the row at its full content width, and the page
                          forces a layout viewport wider than a phone screen -
                          which pushes the navbar controls off-screen (#1224). */}
                      <pre className="min-w-0 flex-1 overflow-x-auto font-heading text-xs text-text-secondary">
                        <span className="text-amber">{`![${embed.altText}]`}</span>
                        {"(chapa.thecreativetoken.com/u/"}
                        <span className="text-amber/70">developer</span>
                        {"/badge.svg)"}
                      </pre>
                      <CopyButton text={embedSnippet} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── How it works ─────────────────────────────────── */}
          <section id="how-it-works">
            <SectionHeader
              command="chapa explain"
              title={sections.howItWorks}
              meta={interpolate(sectionMeta.explain!, { count: String(steps.length) })}
            />
            <ol className="grid gap-4 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.number} className="rounded-xl border border-stroke bg-card p-5">
                  <span className="font-heading text-2xl tabular-nums text-amber">
                    {step.number}
                  </span>
                  <h3 className="mt-3 font-heading text-sm text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-pretty text-text-secondary">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Scoring: a meter list, not prose ─────────────── */}
          <section id="scoring">
            <SectionHeader
              command="chapa score @developer"
              title={measure.title}
              meta={interpolate(sectionMeta.score!, {
                score: String(demoImpact.adjustedComposite),
                tier: tierLabel.toLowerCase(),
              })}
            />
            <p className="mb-6 text-sm text-pretty text-text-secondary">
              {measure.descriptionBefore}{" "}
              <ArchetypeLinks archetypes={archetypes} orConnector={orConnector} />.
            </p>
            <ul className="space-y-3">
              {DIMENSION_STYLES.map(({ key, bar }, index) => {
                const value = demoImpact.dimensions[key];
                const dimension = dimensions[index];
                if (value === undefined || !dimension) return null;
                return (
                  <li key={key} className="flex items-center gap-4">
                    <span className="w-28 shrink-0 font-heading text-xs lowercase text-text-secondary">
                      {dimension.title}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                      <span
                        className={`block h-full rounded-full ${bar}`}
                        style={{ width: `${value}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right font-heading text-sm tabular-nums text-text-primary">
                      {value}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/about/scoring"
              className="mt-6 inline-flex items-center gap-1 font-heading text-sm text-amber transition-colors hover:text-amber-light"
            >
              {measure.methodologyLink}
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </section>

          {/* ── Enterprise ───────────────────────────────────── */}
          <section id="enterprise">
            <SectionHeader
              command="chapa enterprise"
              title={sections.enterprise}
              meta={sectionMeta.enterprise}
            />
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="font-heading text-xl tracking-tight text-balance">
                  {enterprise.title} <span className="text-amber">{enterprise.highlight}</span>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-pretty text-text-secondary">
                  {enterprise.description}
                </p>
                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="font-heading text-xs lowercase text-dimension-delivery">{enterprise.whatItDoes}</dt>
                    <dd className="text-text-secondary">{enterprise.whatItDoesText}</dd>
                  </div>
                  <div>
                    <dt className="font-heading text-xs lowercase text-dimension-consistency">{enterprise.howToUse}</dt>
                    <dd className="text-text-secondary">
                      {enterprise.howToUseTextBefore}{" "}
                      <code className="rounded bg-amber/10 px-1.5 py-0.5 font-heading text-xs text-text-primary">
                        npx chapa-cli
                      </code>{" "}
                      {enterprise.howToUseTextAfter}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-heading text-xs lowercase text-dimension-breadth">{enterprise.noEmu}</dt>
                    <dd className="text-text-secondary">{enterprise.noEmuText}</dd>
                  </div>
                </dl>
              </div>

              {/* The CLI transcript stays dark in both themes: it is a
                  terminal, not a page surface. */}
              <div className="self-start rounded-xl border border-forest-line bg-forest p-4 font-heading text-sm leading-relaxed">
                <p className="text-forest-text">
                  <span className="select-none text-forest-dim">$ </span>
                  npx chapa-cli
                </p>
                <p className="mt-1 text-forest-ok">
                  <span className="select-none text-forest-dim">&gt; </span>
                  {enterprise.terminalAuthenticated}
                </p>
                <p className="text-forest-ok">
                  <span className="select-none text-forest-dim">&gt; </span>
                  {enterprise.terminalFound}
                </p>
                <p className="text-forest-ok">
                  <span className="select-none text-forest-dim">&gt; </span>
                  {enterprise.terminalMerged}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── Persistent terminal input ───────────────────── */}
        <LandingTerminal />
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <SiteFooter t={t} showCta />
    </div>
  );
}

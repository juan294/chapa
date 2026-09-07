import Link from "next/link";
import type { ImpactV6Result } from "@chapa/shared";
import type { LeaderboardPlace } from "@/lib/profile/leaderboard";
import { BadgeOverlay } from "@/components/BadgeOverlay";
import { NavbarClient } from "@/components/NavbarClient";
import { SectionHeader } from "@/components/SectionHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginCtaButton } from "@/components/LoginCtaButton";
import { ArchetypeExplorer } from "@/components/landing/ArchetypeExplorer";
import { DimensionExplorer } from "@/components/landing/DimensionExplorer";
import { LandingCopyButton } from "@/components/landing/LandingCopyButton";
import { CommandPrompt } from "@/components/landing/CommandPrompt";
import { GitHubIcon, BitbucketIcon, CodebergIcon, GitlabIcon } from "@/components/icons";
import { tArray, tObject } from "@/lib/i18n/typed-accessors";
import { interpolate } from "@/lib/i18n/interpolate";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import { BUILDER_IMPACT, GUARDIAN_IMPACT, MARATHONER_IMPACT, POLYMATH_IMPACT, ARTIFICER_IMPACT, BALANCED_IMPACT, EMERGING_IMPACT } from "@/lib/render/archetypeDemoData";
import { LandingUrlEffects } from "./LandingUrlEffects";
import { LandingTerminal } from "./LandingTerminal";

type TFunction = (key: string) => unknown;
const DIMENSIONS = ["delivery", "quality", "consistency", "breadth", "craft"] as const;
const EXAMPLES = [
  { id: "builder", glyph: "↗", impact: BUILDER_IMPACT },
  { id: "guardian", glyph: "[✓]", impact: GUARDIAN_IMPACT },
  { id: "marathoner", glyph: "∞", impact: MARATHONER_IMPACT },
  { id: "polymath", glyph: "✳", impact: POLYMATH_IMPACT },
  { id: "artificer", glyph: "✦", impact: ARTIFICER_IMPACT },
  { id: "balanced", glyph: "=", impact: BALANCED_IMPACT },
  { id: "emerging", glyph: "_", impact: EMERGING_IMPACT },
] as const;
const PLATFORMS = [
  { name: "GitHub", Icon: GitHubIcon },
  { name: "Bitbucket", Icon: BitbucketIcon },
  { name: "Codeberg", Icon: CodebergIcon },
  { name: "GitLab", Icon: GitlabIcon },
] as const;
const WEBMCP_TRANSCRIPT_URL = "https://github.com/juan294/chapa/blob/main/docs/webmcp-demo-transcript.md";
const SITE_TOOL_COUNT = new Set(SITE_TOOL_MAP.flatMap((entry) => entry.tools)).size;
const action = "inline-flex min-h-12 items-center justify-between gap-4 rounded-[3px] border border-action bg-action px-6 py-3 font-heading text-sm font-semibold text-action-text shadow-card transition-colors hover:bg-action-hover";
const inner = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-12";
/** Podium places, gold to bronze. A fourth entry would fall back to a neutral. */
const MEDALS = ["bg-medal-gold", "bg-medal-silver", "bg-medal-bronze"];

/** Static translated body; interactions and URL effects stay in small client leaves. */
export function LandingContent({ demoBadgeSvg, readmeBadgeSvg, demoImpact, topScored = [], t }: {
  demoBadgeSvg: string; readmeBadgeSvg: string; demoImpact: ImpactV6Result; topScored?: LeaderboardPlace[]; t: TFunction;
}) {
  const r = (key: string) => t(`landing.redesign.${key}`) as string;
  const navLinks = tArray<{ label: string; href: string }>(t, "landing.navLinks");
  const lines = tArray<string>(t, "landing.redesign.headingLines");
  const dimensions = tArray<{ title: string; description: string }>(t, "landing.dimensions");
  const enterprise = tObject<Record<string, string>>(t, "landing.enterprise");
  const agentTools = tObject<Record<string, string>>(t, "landing.agentTools");
  const goals = tObject<Record<(typeof SITE_TOOL_MAP)[number]["route"], string>>(t, "landing.redesign.goals");
  const steps = tArray<{ number: string; title: string; description: string }>(t, "landing.steps");
  const tierLabel = t(`tiers.${demoImpact.tier.toLowerCase()}`) as string;
  const sampleAlt = interpolate(r("sampleAlt"), { score: String(demoImpact.adjustedComposite), tier: tierLabel });
  const snippet = `![${t("landing.embed.altText") as string}](https://chapa.thecreativetoken.com/u/developer/badge.svg)`;
  const explorerItems = EXAMPLES.map(({ id, glyph, impact }) => ({
    id, glyph, label: t(`landing.archetypes.${id}`) as string, description: r(`archetypeDescriptions.${id}`),
    dimensions: DIMENSIONS.flatMap((key, index) => impact.dimensions[key] === undefined ? [] : [{ label: dimensions[index]!.title, value: impact.dimensions[key]! }]),
  }));
  return <div className="min-h-screen bg-bg text-text-primary">
    <LandingUrlEffects /><NavbarClient navLinks={navLinks} />
    <main id="main-content" className="pt-[69px]">
      {/* Terminal chrome carrying the platform's current standings: the three
          highest live scores, each linking to that public badge. Sourced from
          snapshots, never the signup table (see dbGetTopScoredProfiles). */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-stroke bg-card px-5 py-0.5 font-heading text-[11px] text-text-secondary sm:px-8">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-track" />
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-track" />
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-track" />
          <Link href="/about/leaderboard" className="ml-3 inline-flex min-h-11 items-center underline-offset-4 hover:text-text-primary hover:underline">
            {r("leaderboardExplainer")}
          </Link>
        </span>
        {topScored.length > 0 && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="tracking-wider uppercase">{r("topScoresLabel")}</span>
            <ol className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {topScored.map((place) => (
                <li key={place.score} className="flex items-center gap-2">
                  <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-[2px] px-1 text-[10px] font-semibold text-forest ${MEDALS[place.rank - 1] ?? "bg-track"}`}>
                    {place.rank}
                  </span>
                  {/* Everyone in a place shares the score, so it is printed
                      once at the end rather than after each handle. */}
                  {place.handles.map((handle, index) => (
                    <Link key={handle} href={`/u/${handle}`} className="inline-flex min-h-11 min-w-11 items-center text-text-primary underline-offset-4 hover:underline">
                      @{handle}{index < place.handles.length - 1 ? "," : ""}
                    </Link>
                  ))}
                  <span className="tabular-nums text-amber-text">{place.score}</span>
                </li>
              ))}
            </ol>
          </span>
        )}
      </div>
      <section id="hero" className="grid scroll-mt-24 border-b border-stroke lg:grid-cols-[.95fr_1.05fr]">
        <div className="min-w-0 px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <CommandPrompt command="/whoami" className="min-h-11 font-heading text-xs text-text-primary"><span className="text-amber-text">guest@chapa:~</span> $ /whoami<span className="animate-cursor-blink text-amber-text" aria-hidden="true"> ▌</span></CommandPrompt>
          <h1 className="mt-5 font-display text-[clamp(3.8rem,8.4vw,9rem)] leading-[.87] font-extrabold tracking-tight uppercase">
            {lines.map((line, index) => <span key={line} className={`block break-words ${index === lines.length - 1 ? "font-heading text-[.78em] font-bold leading-[1.15] tracking-tighter text-amber-text" : ""}`}>{line}</span>)}
          </h1>
          <p className="mt-8 max-w-lg text-base leading-relaxed text-text-secondary">{r("explanation")}</p>
          <div className="mt-7 flex flex-wrap items-center gap-4"><LoginCtaButton label={r("loginCta")} pendingLabel={t("landing.finalCta.buttonPending") as string} size="lg" /><Link href="#features" className="inline-flex min-h-11 items-center font-heading text-sm underline underline-offset-4">/archetypes ↓</Link></div>
          <dl id="stats" className="mt-9 flex flex-wrap gap-7 border-t border-stroke pt-5">
            {tArray<{ value: string; label: string }>(t, "landing.stats").map((stat) => <div key={stat.label}><dd className="font-heading text-2xl">{stat.value}</dd><dt className="font-heading text-[11px] text-text-secondary">{stat.label}</dt></div>)}
          </dl>
        </div>
        <div id="badge-preview" className="relative flex min-w-0 scroll-mt-28 flex-col justify-between overflow-hidden border-t border-stroke bg-hero-band px-6 py-8 sm:px-10 lg:border-t-0 lg:border-l">
          <div className="relative z-10 flex flex-wrap justify-between gap-3 font-heading text-[11px] text-text-secondary"><span>~/developer/profile.chapa</span><span>{r("stageLabel")}</span></div>
          <span aria-hidden="true" className="pointer-events-none absolute top-[14%] left-[-22%] aspect-square w-[78%] rounded-full bg-amber-dark" />
          <div className="relative mx-auto my-16 w-full max-w-[1200px] -rotate-3 sm:my-24">
            {/* A second panel offset behind the frame: the badge reads as one
                artifact off a stack, and the stage gains depth the flat SVG
                cannot carry on its own. */}
            <div aria-hidden="true" className="absolute inset-0 translate-x-4 translate-y-5 bg-dark-section" />
            <div className="relative border border-forest-line bg-dark-section p-3 shadow-[0_30px_70px_-20px_rgba(0,0,0,.75)] sm:p-4">
              {/* Escaped output of the one production renderer. The overlay
                  sits inside this box, not the frame around it: its hotspots
                  are percentages of the 1200x630 viewBox, so the box they
                  fill must be the SVG itself, never the frame's padding or
                  the inspect row below. */}
              <div className="relative">
                <div role="img" aria-label={sampleAlt} className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: demoBadgeSvg }} />
                <BadgeOverlay />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 font-heading text-[11px] text-forest-dim">
                <span>/inspect badge.svg</span>
                <Link href="/studio" className="inline-flex min-h-11 items-center tracking-wider text-forest-text uppercase underline-offset-4 hover:underline focus-visible:outline-forest-text!">{r("studioCta")} ↗</Link>
              </div>
            </div>
          </div>
          <div className="relative z-10"><p className="font-heading text-base leading-snug">{r("stageCaption").split(/(?<=\.)\s+/).map(sentence => <span key={sentence} className="block">{sentence}</span>)}</p><p className="mt-5 font-heading text-[11px] tracking-wider text-text-secondary">{r("stageFigure")}</p></div>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-stroke px-5 py-6 sm:px-8">
        <span className="font-heading text-[11px] text-text-secondary">{r("connected")}</span>
        {PLATFORMS.map(({ name, Icon }) => <span key={name} className="inline-flex items-center gap-2 font-heading text-base"><Icon className="h-5 w-5" />{name}</span>)}
        <span className="font-heading text-[11px] text-text-secondary">{r("connectedNote")}</span>
      </div>
      <section id="identity" className={`${inner} scroll-mt-24 py-16 sm:py-24`}>
        <SectionHeader command="/section identity" />
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]"><h2 className="max-w-3xl font-display text-[clamp(2.8rem,6vw,6rem)] leading-[.95] font-bold uppercase">{r("identityTitle")}</h2><div><span aria-hidden="true" className="font-display text-7xl text-amber-text">✳</span><p className="mt-5 text-base leading-relaxed text-text-secondary">{r("identityBody")}</p><Link href="/about" className="mt-4 inline-flex min-h-11 items-center font-heading text-sm underline underline-offset-4">{t("landing.footer.about") as string} ↗</Link></div></div>
      </section>
      <section id="features" className="scroll-mt-24 border-y border-stroke bg-identity-surface py-16 text-identity-text sm:py-24">
        <div className={inner}><div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><p className="font-heading text-xs">~ % /archetypes</p><h2 className="mt-5 max-w-2xl font-display text-[clamp(3rem,7vw,7rem)] font-bold leading-[.9]">{r("explorerTitle")}</h2></div><p className="max-w-sm text-base leading-relaxed">{r("explorerIntro")}</p></div>
          <ArchetypeExplorer items={explorerItems} label={r("explorerLabel")} guideLabel={r("guideLabel")} sampleLabel={r("exampleLabel")} />
        </div>
      </section>
      <section id="scoring" className="scroll-mt-24 bg-forest py-16 text-forest-text sm:py-24"><div className={`${inner} grid gap-10 lg:grid-cols-2`}>
        <div className="min-w-0"><p className="font-heading text-xs text-forest-dim">~ % /dimensions</p><h2 className="mt-5 break-words font-heading text-[clamp(1.4rem,3vw,3rem)] leading-tight">{r("dimensionTitle")}</h2><p className="mt-6 max-w-lg text-base leading-relaxed text-forest-dim">{r("dimensionIntro")}</p><p className="mt-5 font-heading text-sm">{demoImpact.adjustedComposite} / {tierLabel} · {r("stageLabel")}</p><Link href="/about/scoring" className="mt-6 inline-flex min-h-12 items-center border border-forest-text px-5 font-heading text-sm focus-visible:outline-forest-text!">{t("landing.measure.methodologyLink") as string} ↗</Link></div>
        <DimensionExplorer items={DIMENSIONS.flatMap((id, index) => demoImpact.dimensions[id] === undefined ? [] : [{ id, label: dimensions[index]!.title, description: dimensions[index]!.description, value: demoImpact.dimensions[id]! }])} optionalLabel={r("optional")} />
      </div></section>
      <section id="how-it-works" className={`${inner} scroll-mt-24 py-16 sm:py-24`}><div id="embed" className="scroll-mt-24" /><SectionHeader command="/embed" />
        <div className="grid items-center gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><h2 className="font-display text-[clamp(3rem,6vw,6rem)] font-bold leading-[.95]">{r("readmeTitle")}</h2><p className="mt-5 text-base leading-relaxed text-text-secondary">{r("readmeIntro")}</p><ol className="my-7 space-y-4">{steps.map((step) => <li key={step.number} className="flex gap-4 border-t border-stroke pt-4"><span className="font-heading text-xs text-amber-text">{step.number}</span><div><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm text-text-secondary">{step.description}</p></div></li>)}</ol><Link href="/studio" className={action}>{r("studioCta")} ↗</Link></div>
          <div className="min-w-0 rotate-1 border border-text-primary bg-card shadow-card"><div className="flex flex-wrap justify-between gap-3 border-b border-stroke px-5 py-4 font-heading text-[11px]"><span>↳ README.md</span><span>{r("readmePublic")}</span></div><div className="p-5 sm:p-7"><p className="font-heading text-sm text-text-secondary"># hello, world.</p><p className="my-5 text-base">{r("readmeHello")}</p>
            {/* A separate SVG image document avoids duplicate inline defs/IDs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(readmeBadgeSvg)}`} width={1200} height={630} alt={sampleAlt} className="h-auto w-full" />
            <div className="mt-6 flex items-start gap-3 border-t border-stroke pt-4"><pre className="min-w-0 flex-1 overflow-x-auto py-3 font-heading text-[11px]">{snippet}</pre><LandingCopyButton text={snippet} /></div><p className="mt-3 text-xs text-text-secondary">{r("embedNote")}</p>
          </div></div>
        </div>
      </section>
      <section id="enterprise" className="scroll-mt-24 border-y border-stroke bg-card py-16"><div className={inner}><SectionHeader command="/section enterprise" title={t("landing.sections.enterprise") as string} /><div className="grid gap-9 md:grid-cols-2"><div><h3 className="font-display text-4xl font-bold">{enterprise.title} {enterprise.highlight}</h3><p className="mt-5 text-base leading-relaxed text-text-secondary">{enterprise.description}</p><dl className="mt-6 space-y-4 text-sm"><div><dt className="font-heading">{enterprise.whatItDoes}</dt><dd className="mt-1 text-text-secondary">{enterprise.whatItDoesText}</dd></div><div><dt className="font-heading">{enterprise.howToUse}</dt><dd className="mt-1 text-text-secondary">{enterprise.howToUseTextBefore} <code>npx chapa-cli</code> {enterprise.howToUseTextAfter}</dd></div><div><dt className="font-heading">{enterprise.noEmu}</dt><dd className="mt-1 text-text-secondary">{enterprise.noEmuText}</dd></div></dl></div><div className="self-center border border-forest-line bg-forest p-6 font-heading text-sm text-forest-text"><p>$ npx chapa-cli</p><p className="mt-4 text-forest-ok">&gt; {enterprise.terminalAuthenticated}</p><p className="mt-2 text-forest-ok">&gt; {enterprise.terminalFound}</p><p className="mt-2 text-forest-ok">&gt; {enterprise.terminalMerged}</p><p className="mt-5 text-xs text-forest-dim">{r("stageLabel")}</p></div></div></div></section>
      <section id="agent-tools" className="scroll-mt-24 bg-forest py-16 text-forest-text sm:py-24"><div className={inner}><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><p className="font-heading text-xs text-forest-dim">~ % /mcp</p><h2 className="mt-5 font-heading text-[clamp(2rem,4vw,4rem)] leading-tight">{r("agentTitle")}</h2><p className="mt-6 text-base leading-relaxed text-forest-dim">{agentTools.intro}</p><p className="mt-5 font-heading text-xs text-forest-dim">{interpolate(t("landing.sectionMeta.agentTools") as string, { tools: String(SITE_TOOL_COUNT), pages: String(SITE_TOOL_MAP.length) })}</p><p className="mt-6 text-sm leading-relaxed text-forest-dim">{agentTools.boundary}</p></div><div className="border-t border-forest-line">{SITE_TOOL_MAP.map((entry) => <article key={entry.route} className="border-b border-forest-line py-5"><h3 className="break-words font-heading text-sm">{entry.route}</h3><p className="mt-3 text-sm text-forest-dim">{goals[entry.route]}</p><ul className="mt-4 flex flex-wrap gap-2">{entry.tools.map((tool) => <li key={tool} className="break-all border border-forest-line px-2 py-1 font-heading text-[11px]">{tool}</li>)}</ul></article>)}</div></div><p className="mt-8 text-sm text-forest-dim">{agentTools.transcriptBefore} <a href={WEBMCP_TRANSCRIPT_URL} target="_blank" rel="noopener noreferrer" className="text-forest-text underline underline-offset-4 focus-visible:outline-forest-text!">{agentTools.transcriptLink}</a> {agentTools.transcriptAfter}</p></div></section>
      <section id="trust" className="scroll-mt-24 border-y border-stroke bg-purple-tint py-14"><div className={`${inner} grid items-center gap-7 md:grid-cols-[auto_1fr_1.5fr]`}><span aria-hidden="true" className="font-heading text-5xl text-complement-text">[✓]</span><h2 className="font-display text-5xl font-bold leading-none">{r("trustTitle")}</h2><div><p className="text-base leading-relaxed text-text-secondary">{r("trustBody")}</p><div className="mt-4 flex flex-wrap gap-5"><Link href="/verify" className="inline-flex min-h-11 items-center font-heading text-sm text-complement-text underline underline-offset-4">{t("landing.hero.verifyCta") as string} ↗</Link><Link href="/about/verification" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{r("verificationMethod")}</Link></div></div></div></section>
      <section id="closing" className="scroll-mt-24 bg-closing-surface py-16 text-closing-text sm:py-24 [&_:focus-visible]:outline-closing-text!"><div className={inner}><p className="font-heading text-xs">{r("closingEyebrow")}</p><h2 className="my-9 max-w-5xl font-display text-[clamp(4rem,13vw,13rem)] leading-[.85] font-extrabold">{r("closingTitle")} ↗</h2><LoginCtaButton label={t("landing.finalCta.button") as string} pendingLabel={t("landing.finalCta.buttonPending") as string} size="lg" /><div className="mt-12 border-t border-current pt-6 font-heading text-3xl">chapa_</div></div></section>
    </main>
    <SiteFooter t={t} />
    <LandingTerminal />
  </div>;
}

import { ErrorBanner } from "@/components/ErrorBanner";
import { Navbar } from "@/components/Navbar";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingTerminal } from "./LandingTerminal";
import Link from "next/link";

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Stats", href: "#stats" },
];

const FEATURES = [
  {
    title: "FOUR DIMENSIONS",
    description: "Building, Guarding, Consistency, Breadth — what kind of developer you are, not just how much code you write.",
  },
  {
    title: "DEVELOPER ARCHETYPE",
    description: (<><Link href="/archetypes/builder" className="text-amber hover:text-amber-light transition-colors">Builder</Link>, <Link href="/archetypes/guardian" className="text-[#F472B6] hover:text-[#F9A8D4] transition-colors">Guardian</Link>, <Link href="/archetypes/marathoner" className="text-terminal-green hover:text-[#6EE7A0] transition-colors">Marathoner</Link>, <Link href="/archetypes/polymath" className="text-terminal-yellow hover:text-[#FCD34D] transition-colors">Polymath</Link> — your profile shape tells a story.</>),
  },
  {
    title: "CONFIDENCE RATING",
    description: "Transparent quality signals. No false positives.",
  },
  {
    title: "VERIFIED METRICS",
    description: "Every badge carries an HMAC hash seal. Click it to cryptographically verify the scores haven\u2019t been tampered with.",
  },
  {
    title: "ONE-CLICK EMBED",
    description: "Markdown or HTML, paste anywhere that renders images.",
  },
];

const STEPS = [
  { number: "01", title: "Sign in with GitHub", description: "OAuth login — we only request access to public data." },
  { number: "02", title: "We build your profile", description: "12 months of activity → 4 dimensions, archetype, and composite score." },
  { number: "03", title: "Share your badge", description: "Embed the live SVG in your README, portfolio, anywhere." },
];

const STATS = [
  { value: "6", label: "archetypes" },
  { value: "4", label: "dimensions" },
  { value: "365", label: "days scored" },
];

/* ── Icons ─────────────────────────────────────────────────────── */

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = getOAuthErrorMessage(error);

  return (
    <div className="bg-bg min-h-screen text-text-primary">
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <Navbar navLinks={NAV_LINKS} />

      <main id="main-content">
        {/* ── Terminal session ─────────────────────────────── */}
        <div className="mx-auto max-w-4xl px-6 pt-28 pb-32 space-y-24">

          {/* ── Hero: $ chapa ──────────────────────────────── */}
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-4">
              <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[0.95]">
                Developer Impact,
                <br />
                <span className="text-amber">Decoded</span>
              </h1>
              <div className="space-y-1 font-heading text-sm text-text-secondary">
                <p><span className="text-terminal-dim select-none">&gt;</span> AI writes the code. What matters is how you drive impact.</p>
                <p><span className="text-terminal-dim select-none">&gt;</span> Building, Guarding, Breadth, Consistency — four dimensions beyond commits and lines of code.</p>
                <p><span className="text-terminal-dim select-none">&gt;</span> Built for the age of AI-assisted engineering.</p>
                <p><span className="text-terminal-dim select-none">&gt;</span> Every score is cryptographically sealed. Verifiable, not just trusted.</p>
              </div>
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <a
                  href="/api/auth/login"
                  className="group inline-flex items-center gap-2.5 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
                >
                  <GitHubIcon className="w-4 h-4" />
                  Get Your Badge
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
                <Link
                  href="/verify"
                  className="group inline-flex items-center gap-2.5 rounded-lg bg-complement px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#34D399] hover:shadow-xl hover:shadow-complement/25"
                >
                  <ShieldCheckIcon className="w-4 h-4" />
                  Verify a Badge
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── Badge Preview: $ chapa preview @developer ──── */}
          <section id="badge-preview" className="animate-fade-in-up [animation-delay:200ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa preview @developer</span>
            </div>
            <div className="pl-4 border-l border-stroke">
              <div
                className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: demoBadgeSvg }}
              />
            </div>
          </section>

          {/* ── Embed: $ chapa embed ──────────────────────── */}
          <section className="animate-fade-in-up [animation-delay:400ms]">
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
                    embed snippet
                  </span>
                </div>
                <div className="p-4 font-heading text-sm leading-relaxed">
                  <p className="text-terminal-dim">
                    <span className="text-amber/50">{"<!-- "}</span>
                    Add to your README
                    <span className="text-amber/50">{" -->"}</span>
                  </p>
                  <p className="text-text-primary/80 mt-1">
                    <span className="text-amber">{"![Impact Badge]("}</span>
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
          <h2 className="sr-only">Features</h2>
          <section id="features" className="animate-fade-in-up [animation-delay:600ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa features</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 w-44 sm:w-48">
                    {feature.title}
                  </span>
                  <span className="text-text-secondary text-sm">
                    {feature.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── How It Works: $ chapa explain ─────────────── */}
          <h2 className="sr-only">How It Works</h2>
          <section id="how-it-works" className="animate-fade-in-up [animation-delay:800ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa explain</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-6">
              {STEPS.map((step) => (
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
            </div>
          </section>

          {/* ── Enterprise: $ chapa enterprise ────────────── */}
          <h2 className="sr-only">Enterprise</h2>
          <section className="animate-fade-in-up [animation-delay:900ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa enterprise</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-5">
              <div>
                <h3 className="font-heading text-lg tracking-tight text-text-primary">
                  GitHub <span className="text-amber">Enterprise Managed Users</span>
                </h3>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-2xl">
                  Work at a company that uses GitHub Enterprise? Your corporate contributions
                  (commits, PRs, reviews) live in a separate EMU namespace and don&apos;t show up
                  on your personal profile. Chapa can merge them into your badge.
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
                    Authenticated as @developer
                  </p>
                  <p className="text-terminal-green">
                    <span className="text-terminal-dim select-none">&gt; </span>
                    Found EMU account: @developer_company
                  </p>
                  <p className="text-terminal-green">
                    <span className="text-terminal-dim select-none">&gt; </span>
                    Merged 312 enterprise contributions into badge
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-4 items-start">
                  <span className="text-amber font-heading text-sm shrink-0 w-44 sm:w-48">
                    WHAT IT DOES
                  </span>
                  <span className="text-text-secondary text-sm">
                    Links your EMU stats with your personal GitHub — one unified badge.
                  </span>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="text-amber font-heading text-sm shrink-0 w-44 sm:w-48">
                    HOW TO USE
                  </span>
                  <span className="text-text-secondary text-sm">
                    Run{" "}
                    <code className="font-heading text-text-primary/80 bg-amber/10 px-1.5 py-0.5 rounded text-xs">
                      npx chapa-cli
                    </code>{" "}
                    and follow the prompts. Takes under a minute.
                  </span>
                </div>
                <div className="flex gap-4 items-start">
                  <span className="text-amber font-heading text-sm shrink-0 w-44 sm:w-48">
                    NO EMU?
                  </span>
                  <span className="text-text-secondary text-sm">
                    No problem — your public GitHub activity is all you need. The CLI is optional.
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Stats: $ chapa stats ──────────────────────── */}
          <h2 className="sr-only">Stats</h2>
          <section id="stats" className="animate-fade-in-up [animation-delay:1100ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa stats</span>
            </div>
            <div className="pl-4 border-l border-stroke">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-4 font-heading text-sm">
                {STATS.map((stat, i) => (
                  <span key={stat.label} className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl tracking-tight text-amber">
                      {stat.value}
                    </span>
                    <span className="text-text-secondary">{stat.label}</span>
                    {i < STATS.length - 1 && (
                      <span className="text-terminal-dim ml-4">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA: $ chapa login ────────────────────────── */}
          <h2 className="sr-only">Get Started</h2>
          <section className="animate-fade-in-up [animation-delay:1300ms]">
            <div className="flex items-center gap-2 mb-6 font-heading text-sm">
              <span className="text-terminal-dim select-none">$</span>
              <span className="text-text-secondary">chapa login</span>
            </div>
            <div className="pl-4 border-l border-stroke space-y-6">
              <p className="text-text-secondary text-sm">
                Ready to prove your impact?
              </p>
              <a
                href="/api/auth/login"
                className="group inline-flex items-center gap-2.5 rounded-lg bg-amber px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
              >
                <GitHubIcon className="w-5 h-5" />
                Get Your Badge
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
                Built for developers, by developers.
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <GitHubIcon className="w-3 h-3" />
              <span>Powered by GitHub</span>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <a href="/about" className="hover:text-amber transition-colors">About</a>
              <a href="/terms" className="hover:text-amber transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-amber transition-colors">Privacy</a>
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

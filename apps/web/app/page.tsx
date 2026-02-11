import { ErrorBanner } from "@/components/ErrorBanner";
import { Navbar } from "@/components/Navbar";
import { getOAuthErrorMessage } from "@/lib/auth/error-messages";
import { LandingTerminal } from "./LandingTerminal";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Stats", href: "#stats" },
];

/* ── Heatmap data (13 weeks x 7 days) ──────────────────────────
   0 = none, 1 = low, 2 = medium, 3 = high, 4 = intense */
const HEATMAP: number[][] = [
  [0, 2, 3, 2, 1, 0, 0],
  [1, 3, 4, 3, 2, 1, 0],
  [2, 4, 3, 4, 3, 0, 0],
  [1, 2, 4, 3, 2, 1, 0],
  [0, 1, 2, 3, 2, 0, 0],
  [3, 4, 4, 3, 4, 1, 0],
  [2, 3, 2, 4, 3, 0, 1],
  [1, 2, 3, 2, 1, 0, 0],
  [0, 3, 4, 4, 3, 1, 0],
  [2, 4, 3, 2, 4, 0, 0],
  [1, 3, 4, 3, 2, 1, 0],
  [3, 4, 2, 4, 3, 0, 1],
  [2, 3, 4, 3, 2, 1, 0],
];

const HEATMAP_COLORS: Record<number, string> = {
  0: "bg-amber/[0.04]",
  1: "bg-amber/15",
  2: "bg-amber/30",
  3: "bg-amber/55",
  4: "bg-amber/85",
};

const FEATURES = [
  {
    title: "IMPACT SCORE V3",
    description: "Commits, PRs, reviews — 90 days of real activity, one score.",
  },
  {
    title: "CONFIDENCE RATING",
    description: "Transparent quality signals. No false positives.",
  },
  {
    title: "ONE-CLICK EMBED",
    description: "Markdown or HTML, paste anywhere that renders images.",
  },
];

const STEPS = [
  { number: "01", title: "Sign in with GitHub", description: "OAuth login — we only request access to public data." },
  { number: "02", title: "We crunch the numbers", description: "90 days of activity → Impact Score + Confidence rating." },
  { number: "03", title: "Share your badge", description: "Embed the live SVG in your README, portfolio, anywhere." },
];

const STATS = [
  { value: "12,400+", label: "badges generated" },
  { value: "4", label: "impact tiers" },
  { value: "90", label: "days analyzed" },
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
                Developer Impact
                <br />
                <span className="text-amber">Badge</span>
              </h1>
              <div className="space-y-1 font-heading text-sm text-text-secondary">
                <p><span className="text-terminal-dim select-none">&gt;</span> Analyzes 90 days of GitHub activity.</p>
                <p><span className="text-terminal-dim select-none">&gt;</span> Generates a live, embeddable SVG badge.</p>
                <p><span className="text-terminal-dim select-none">&gt;</span> Impact Score + Confidence + Tier.</p>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row items-start gap-3">
                <a
                  href="/api/auth/login"
                  className="group flex items-center gap-2.5 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
                >
                  <GitHubIcon className="w-4 h-4" />
                  Get Your Badge
                  <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#badge-preview"
                  className="flex items-center gap-2 rounded-lg border border-stroke px-6 py-3 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary"
                >
                  See Example
                </a>
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
              {/* Badge card — always dark */}
              <div className="relative rounded-xl border border-stroke bg-[#111118] shadow-2xl shadow-black/30 overflow-hidden">
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber/30 to-transparent animate-shimmer" />

                <div className="p-6 md:p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center">
                        <GitHubIcon className="w-5 h-5 text-amber" />
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary">@developer</p>
                        <p className="text-sm text-text-secondary">Last 90 days</p>
                      </div>
                    </div>
                    <span className="text-sm font-heading text-text-secondary/50 tracking-tight">
                      Chapa<span className="text-amber">.</span>
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
                    {/* Heatmap */}
                    <div className="flex-shrink-0">
                      <p className="text-[10px] tracking-widest uppercase text-text-secondary/60 mb-2">
                        Activity
                      </p>
                      <div className="flex gap-[3px]">
                        {HEATMAP.map((week, wi) => (
                          <div key={wi} className="flex flex-col gap-[3px]">
                            {week.map((level, di) => (
                              <div
                                key={`${wi}-${di}`}
                                className={`w-[10px] h-[10px] rounded-[2px] ${HEATMAP_COLORS[level]} transition-colors`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] tracking-widest uppercase text-text-secondary/60 mb-1">
                          Impact Score
                        </p>
                        <div className="flex items-baseline gap-3">
                          <span className="text-6xl font-heading tracking-tighter text-text-primary">
                            94
                          </span>
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 border border-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber">
                              <StarIcon className="w-3 h-3" />
                              Elite
                            </span>
                            <span className="text-xs text-text-secondary">
                              87% Confidence
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary/70">
                        <span>847 commits</span>
                        <span className="text-text-secondary/30">|</span>
                        <span>42 PRs merged</span>
                        <span className="text-text-secondary/30">|</span>
                        <span>28 reviews</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-text-secondary/60">
                      <GitHubIcon className="w-3 h-3" />
                      <span>Powered by GitHub</span>
                    </div>
                    <span className="text-[10px] text-text-secondary/60 font-heading">
                      chapa.thecreativetoken.com
                    </span>
                  </div>
                </div>
              </div>
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

          {/* ── Stats: $ chapa stats ──────────────────────── */}
          <h2 className="sr-only">Stats</h2>
          <section id="stats" className="animate-fade-in-up [animation-delay:1000ms]">
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
          <section className="animate-fade-in-up [animation-delay:1200ms]">
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
                Chapa<span className="text-amber">.</span>
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

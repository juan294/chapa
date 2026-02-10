import Link from "next/link";

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
    title: "Impact Score v3",
    description:
      "Analyzes commits, PRs merged, code reviews, and issues closed across your last 90 days of GitHub activity.",
    icon: "chart" as const,
  },
  {
    title: "Confidence Rating",
    description:
      "Transparent quality signals that surface patterns — no false positives, no accusations. Just honest data.",
    icon: "shield" as const,
  },
  {
    title: "One-Click Embed",
    description:
      "Copy a markdown or HTML snippet and paste it into your README, portfolio, or anywhere you want.",
    icon: "code" as const,
  },
];

const STEPS = [
  {
    number: "01",
    title: "Sign in with GitHub",
    description:
      "OAuth login. We only request access to public data — nothing private, nothing scary.",
  },
  {
    number: "02",
    title: "We crunch the numbers",
    description:
      "90 days of activity, transformed into an Impact Score plus a Confidence rating. Computed in seconds.",
  },
  {
    number: "03",
    title: "Share your badge",
    description:
      "Embed the live SVG in your README, portfolio, resume — anywhere that renders images.",
  },
];

const STATS = [
  { value: "12,400+", label: "Badges Generated" },
  { value: "4", label: "Impact Tiers" },
  { value: "90", label: "Days Analyzed" },
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

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 5-10" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
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

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.7 10.3a2.41 2.41 0 000 3.41l7.59 7.59a2.41 2.41 0 003.41 0l7.59-7.59a2.41 2.41 0 000-3.41L13.7 2.71a2.41 2.41 0 00-3.41 0L2.7 10.3z" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ReactNode> = {
  chart: <ChartIcon className="w-6 h-6" />,
  shield: <ShieldIcon className="w-6 h-6" />,
  code: <CodeIcon className="w-6 h-6" />,
};

/* ── Page ──────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="bg-warm-bg min-h-screen text-text-primary">
      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-warm-stroke bg-warm-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold font-heading tracking-tight">
              Chapa<span className="text-amber">.</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 rounded-full border border-warm-stroke bg-warm-card/60 px-1.5 py-1">
            {["Features", "How it Works", "Stats"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-full px-4 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary hover:bg-amber/[0.06]"
              >
                {item}
              </a>
            ))}
          </div>

          <a
            href="/api/auth/github"
            className="flex items-center gap-2 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-warm-bg transition-all hover:bg-amber-light hover:shadow-lg hover:shadow-amber/20"
          >
            <GitHubIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Get Your Badge</span>
            <span className="sm:hidden">Sign in</span>
          </a>
        </div>
      </nav>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
          {/* Background layers */}
          <div className="absolute inset-0 bg-grid-warm" />
          <div className="absolute top-1/4 right-1/4 w-[800px] h-[600px] rounded-full bg-amber/[0.04] blur-[150px]" />
          <div className="absolute bottom-1/4 left-1/6 w-[500px] h-[500px] rounded-full bg-amber/[0.03] blur-[120px]" />

          {/* Floating decorative pills */}
          <div className="absolute top-32 left-[8%] animate-drift [animation-delay:0ms]">
            <div className="rounded-full border border-warm-stroke bg-warm-card/40 px-4 py-2 text-xs text-text-secondary/60 backdrop-blur-sm">
              847 commits
            </div>
          </div>
          <div className="absolute top-48 right-[12%] animate-drift [animation-delay:2000ms]">
            <div className="rounded-full border border-amber/20 bg-amber/[0.06] px-4 py-2 text-xs text-amber/70 backdrop-blur-sm">
              Elite Tier
            </div>
          </div>
          <div className="absolute bottom-40 left-[15%] animate-drift [animation-delay:4000ms]">
            <div className="rounded-full border border-warm-stroke bg-warm-card/40 px-4 py-2 text-xs text-text-secondary/60 backdrop-blur-sm">
              42 PRs merged
            </div>
          </div>
          <div className="absolute bottom-56 right-[8%] animate-drift [animation-delay:1000ms]">
            <DiamondIcon className="w-5 h-5 text-amber/20" />
          </div>
          <div className="absolute top-64 left-[45%] animate-float-slow">
            <DiamondIcon className="w-4 h-4 text-amber/10" />
          </div>

          {/* Two-column hero */}
          <div className="relative z-10 mx-auto max-w-7xl px-6 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
              {/* Left: Text content */}
              <div>
                {/* Eyebrow */}
                <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/[0.06] px-4 py-1.5 text-sm text-amber">
                  <DiamondIcon className="w-3.5 h-3.5" />
                  <span>Your developer impact, quantified</span>
                </div>

                {/* Headline */}
                <h1 className="animate-fade-in-up [animation-delay:150ms] font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
                  Your Dev Impact,
                  <br />
                  <span className="font-bold text-amber">One Badge Away</span>
                </h1>

                {/* Subtitle */}
                <p className="animate-fade-in-up [animation-delay:300ms] mt-6 max-w-lg text-lg text-text-secondary leading-relaxed">
                  Chapa analyzes your last 90 days of GitHub activity and
                  generates a beautiful, embeddable Impact Score badge — share
                  it anywhere.
                </p>

                {/* CTAs */}
                <div className="animate-fade-in-up [animation-delay:450ms] mt-8 flex flex-col sm:flex-row items-start gap-4">
                  <a
                    href="/api/auth/github"
                    className="group flex items-center gap-2.5 rounded-full bg-amber px-8 py-3.5 text-base font-semibold text-warm-bg transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 animate-pulse-glow-amber"
                  >
                    <GitHubIcon className="w-4 h-4" />
                    Get Your Badge
                    <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a
                    href="#badge-preview"
                    className="flex items-center gap-2 rounded-full border border-warm-stroke px-8 py-3.5 text-base font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
                  >
                    See Example
                  </a>
                </div>

                {/* Social proof */}
                <div className="animate-fade-in-up [animation-delay:600ms] mt-10 flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full border-2 border-warm-bg bg-warm-card flex items-center justify-center"
                      >
                        <span className="text-[10px] text-text-secondary/60 font-heading">
                          {String.fromCharCode(64 + i)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <StarIcon
                          key={i}
                          className="w-3.5 h-3.5 text-amber"
                        />
                      ))}
                    </div>
                    <span className="text-xs text-text-secondary/60 mt-0.5">
                      Trusted by 12,400+ developers
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Badge preview card (hero centerpiece) */}
              <div className="animate-scale-in [animation-delay:300ms] relative">
                {/* Outer glow */}
                <div className="absolute -inset-6 rounded-3xl bg-amber/[0.06] blur-3xl" />

                {/* Card */}
                <div className="relative rounded-2xl border border-warm-stroke bg-warm-card shadow-2xl shadow-black/50 overflow-hidden">
                  {/* Shimmer top edge */}
                  <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber/30 to-transparent animate-shimmer" />

                  <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center">
                          <GitHubIcon className="w-5 h-5 text-amber" />
                        </div>
                        <div>
                          <p className="font-semibold text-text-primary">
                            @developer
                          </p>
                          <p className="text-sm text-text-secondary">
                            Last 90 days
                          </p>
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
                        <p className="text-[10px] tracking-widest uppercase text-text-secondary/40 mb-2">
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
                          <p className="text-[10px] tracking-widest uppercase text-text-secondary/40 mb-1">
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
                          <span className="text-warm-stroke">|</span>
                          <span>42 PRs merged</span>
                          <span className="text-warm-stroke">|</span>
                          <span>28 reviews</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t border-warm-stroke flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary/30">
                        <GitHubIcon className="w-3 h-3" />
                        <span>Powered by GitHub</span>
                      </div>
                      <span className="text-[10px] text-text-secondary/20 font-mono">
                        chapa.thecreativetoken.com
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up [animation-delay:900ms]">
            <div className="flex flex-col items-center gap-2 text-text-secondary/30">
              <span className="text-[10px] tracking-[0.2em] uppercase">
                Scroll
              </span>
              <div className="h-8 w-[1px] bg-gradient-to-b from-amber/20 to-transparent" />
            </div>
          </div>
        </section>

        {/* ── Badge Preview (standalone) ──────────────────── */}
        <section
          id="badge-preview"
          className="relative py-32 overflow-hidden border-t border-warm-stroke"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-amber/[0.03] blur-[120px]" />

          <div className="relative z-10 mx-auto max-w-4xl px-6">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                See it in <span className="text-amber">action</span>
              </h2>
              <p className="mt-4 text-text-secondary text-lg">
                A real-time badge that evolves with your contributions.
              </p>
            </div>

            {/* Terminal / embed snippet */}
            <div className="mx-auto max-w-lg">
              <div className="rounded-xl border border-warm-stroke bg-[#0d0b08] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-warm-stroke">
                  <div className="w-3 h-3 rounded-full bg-amber/20" />
                  <div className="w-3 h-3 rounded-full bg-amber/10" />
                  <div className="w-3 h-3 rounded-full bg-amber/[0.06]" />
                  <span className="ml-2 text-xs text-text-secondary/40 font-mono">
                    embed snippet
                  </span>
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed">
                  <p className="text-text-secondary/50">
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
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────── */}
        <section
          id="features"
          className="py-32 border-t border-warm-stroke"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <p className="text-amber text-sm tracking-widest uppercase mb-4">
                Why Chapa
              </p>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                Built for developers
                <br />
                <span className="text-amber">who ship</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 transition-all hover:border-amber/20 hover:bg-warm-card"
                >
                  {/* Decorative number */}
                  <span className="absolute top-6 right-6 text-5xl font-heading text-amber/[0.06] select-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber/[0.08] border border-amber/10 text-amber transition-colors group-hover:bg-amber/15">
                    {ICON_MAP[feature.icon]}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-text-primary mb-3 tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section
          id="how-it-works"
          className="py-32 border-t border-warm-stroke"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center mb-16">
              <p className="text-amber text-sm tracking-widest uppercase mb-4">
                Getting started
              </p>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                Three steps.{" "}
                <span className="text-amber">That&apos;s it.</span>
              </h2>
            </div>

            <div className="relative">
              {/* Connecting line (desktop) */}
              <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-[1px] bg-gradient-to-r from-warm-stroke via-amber/20 to-warm-stroke" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                {STEPS.map((step) => (
                  <div key={step.number} className="relative text-center">
                    <div className="relative z-10 mx-auto inline-flex items-center justify-center w-32 h-32 rounded-full border border-warm-stroke bg-warm-card mb-8">
                      {/* Inner ring */}
                      <div className="absolute inset-2 rounded-full border border-amber/10" />
                      <span className="text-3xl font-heading text-amber">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="font-heading text-lg font-semibold text-text-primary mb-3 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed max-w-xs mx-auto">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────── */}
        <section id="stats" className="py-32 border-t border-warm-stroke">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-10 text-center transition-all hover:border-amber/20"
                >
                  <p className="text-5xl md:text-6xl font-heading tracking-tight text-amber">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-text-secondary">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────── */}
        <section className="relative py-32 overflow-hidden border-t border-warm-stroke">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-amber/[0.05] blur-[140px]" />

          {/* Floating decorative elements */}
          <div className="absolute top-20 left-[10%] animate-float-slow">
            <DiamondIcon className="w-6 h-6 text-amber/10" />
          </div>
          <div className="absolute bottom-20 right-[10%] animate-float-medium">
            <StarIcon className="w-5 h-5 text-amber/10" />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
            {/* Rating badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/[0.06] px-4 py-2 mb-8">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <StarIcon key={i} className="w-3.5 h-3.5 text-amber" />
                ))}
              </div>
              <span className="text-sm text-amber/80">
                Loved by developers
              </span>
            </div>

            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl tracking-tight">
              Ready to prove
              <br />
              <span className="text-amber">your impact?</span>
            </h2>
            <p className="mt-6 text-text-secondary text-lg max-w-xl mx-auto leading-relaxed">
              Join thousands of developers showcasing their real contributions.
              It takes 30 seconds.
            </p>
            <div className="mt-10">
              <a
                href="/api/auth/github"
                className="group inline-flex items-center gap-2.5 rounded-full bg-amber px-10 py-4 text-lg font-semibold text-warm-bg transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 animate-pulse-glow-amber"
              >
                <GitHubIcon className="w-5 h-5" />
                Get Your Badge
                <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-warm-stroke py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="font-heading text-lg tracking-tight">
                Chapa<span className="text-amber">.</span>
              </span>
              <span className="text-sm text-text-secondary/50">
                Built for developers, by developers.
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-secondary/40">
              <GitHubIcon className="w-3.5 h-3.5" />
              <span>Powered by GitHub</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                className="text-text-secondary/40 hover:text-amber/60 transition-colors"
                aria-label="GitHub"
              >
                <GitHubIcon className="w-5 h-5" />
              </a>
              <a
                href="https://x.com"
                className="text-text-secondary/40 hover:text-amber/60 transition-colors"
                aria-label="X (Twitter)"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-text-secondary/30">
            &copy; {new Date().getFullYear()} Chapa. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

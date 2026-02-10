import Link from "next/link";

/* ─── Heatmap data (13 weeks × 7 days) ────────────────────
   0 = none · 1 = low · 2 = medium · 3 = high · 4 = intense */
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
  0: "bg-white/[0.03]",
  1: "bg-mint/15",
  2: "bg-mint/30",
  3: "bg-mint/55",
  4: "bg-mint/85",
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
      "90 days of activity → Impact Score + Confidence rating. Computed in seconds.",
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

const PLATFORMS = [
  "GitHub",
  "GitLab",
  "Bitbucket",
  "npm",
  "DEV.to",
  "Notion",
  "LinkedIn",
];

/* ─── Icons ───────────────────────────────────────────────── */

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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}

/* ─── Icon Map ────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ReactNode> = {
  chart: <ChartIcon className="w-6 h-6" />,
  shield: <ShieldIcon className="w-6 h-6" />,
  code: <CodeIcon className="w-6 h-6" />,
};

/* ─── Page ────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-stroke/50 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold font-heading tracking-tight">
              Chapa<span className="text-mint">.</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 rounded-full border border-stroke bg-card/50 px-1.5 py-1">
            {["Features", "How it Works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-full px-4 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary hover:bg-white/[0.04]"
              >
                {item}
              </a>
            ))}
            <span className="rounded-full px-4 py-1.5 text-sm text-text-secondary/40 cursor-not-allowed select-none">
              Pricing
            </span>
          </div>

          <a
            href="/api/auth/github"
            className="flex items-center gap-2 rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg transition-all hover:bg-mint/90 hover:shadow-lg hover:shadow-mint/20"
          >
            <GitHubIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Sign in with GitHub</span>
            <span className="sm:hidden">Sign in</span>
          </a>
        </div>
      </nav>

      <main>
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
          {/* Background layers */}
          <div className="absolute inset-0 bg-grid" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-mint/[0.06] blur-[150px]" />
          <div className="absolute top-2/3 left-1/3 w-[400px] h-[400px] rounded-full bg-mint/[0.03] blur-[120px]" />

          {/* Hero content */}
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            {/* Eyebrow */}
            <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/[0.06] px-4 py-1.5 text-sm text-mint">
              <SparkleIcon className="w-3.5 h-3.5" />
              <span>Your developer impact, quantified</span>
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up [animation-delay:150ms] font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
              Your Dev Impact,
              <br />
              <span className="font-bold text-mint">One Badge Away</span>
            </h1>

            {/* Subtitle */}
            <p className="animate-fade-in-up [animation-delay:300ms] mt-8 mx-auto max-w-2xl text-lg md:text-xl text-text-secondary leading-relaxed">
              Chapa analyzes your last 90 days of GitHub activity and generates a
              beautiful, embeddable Impact Score badge — share it anywhere.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up [animation-delay:450ms] mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/api/auth/github"
                className="group flex items-center gap-2.5 rounded-full bg-mint px-8 py-3.5 text-base font-semibold text-bg transition-all hover:shadow-xl hover:shadow-mint/25 animate-pulse-glow"
              >
                Get Your Badge
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#badge-preview"
                className="flex items-center gap-2 rounded-full border border-stroke px-8 py-3.5 text-base font-medium text-text-secondary transition-all hover:border-text-secondary/30 hover:text-text-primary hover:bg-white/[0.02]"
              >
                See Example
              </a>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up [animation-delay:800ms]">
            <div className="flex flex-col items-center gap-2 text-text-secondary/40">
              <span className="text-xs tracking-widest uppercase">Scroll</span>
              <div className="h-8 w-[1px] bg-gradient-to-b from-text-secondary/30 to-transparent" />
            </div>
          </div>
        </section>

        {/* ── Logo Bar ──────────────────────────────────── */}
        <section className="border-y border-stroke/50 bg-card/30">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <p className="text-center text-xs tracking-widest uppercase text-text-secondary/50 mb-6">
              Embed your badge anywhere
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {PLATFORMS.map((name) => (
                <span
                  key={name}
                  className="text-sm font-medium text-text-secondary/40 transition-colors hover:text-text-secondary/70"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Badge Preview ─────────────────────────────── */}
        <section
          id="badge-preview"
          className="relative py-32 overflow-hidden"
        >
          {/* Ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-mint/[0.04] blur-[120px]" />

          <div className="relative z-10 mx-auto max-w-5xl px-6">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                See it in <span className="text-mint">action</span>
              </h2>
              <p className="mt-4 text-text-secondary text-lg">
                A real-time badge that evolves with your contributions.
              </p>
            </div>

            {/* Badge mockup */}
            <div className="relative mx-auto max-w-4xl">
              {/* Glow behind card */}
              <div className="absolute -inset-4 rounded-3xl bg-mint/[0.05] blur-2xl" />

              <div className="relative rounded-2xl border border-stroke bg-card p-8 md:p-10 shadow-2xl shadow-black/40">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mint/10 flex items-center justify-center">
                      <GitHubIcon className="w-5 h-5 text-mint" />
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
                  <span className="text-sm font-heading text-text-secondary/60 tracking-tight">
                    Chapa<span className="text-mint">.</span>
                  </span>
                </div>

                {/* Body */}
                <div className="flex flex-col md:flex-row gap-8 md:gap-12">
                  {/* Heatmap */}
                  <div className="flex-shrink-0">
                    <p className="text-xs tracking-widest uppercase text-text-secondary/50 mb-3">
                      Contribution Activity
                    </p>
                    <div className="flex gap-[3px]">
                      {HEATMAP.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {week.map((level, di) => (
                            <div
                              key={`${wi}-${di}`}
                              className={`w-[12px] h-[12px] rounded-[3px] ${HEATMAP_COLORS[level]} transition-colors`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs tracking-widest uppercase text-text-secondary/50 mb-2">
                        Impact Score
                      </p>
                      <div className="flex items-baseline gap-4">
                        <span className="text-7xl font-heading tracking-tighter text-text-primary">
                          94
                        </span>
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 border border-mint/20 px-3 py-1 text-sm font-semibold text-mint">
                            Elite
                          </span>
                          <span className="text-sm text-text-secondary">
                            87% Confidence
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
                      <span>847 commits</span>
                      <span className="text-stroke">·</span>
                      <span>42 PRs merged</span>
                      <span className="text-stroke">·</span>
                      <span>28 reviews</span>
                      <span className="text-stroke">·</span>
                      <span>12 repos</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-stroke flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-text-secondary/40">
                    <GitHubIcon className="w-3.5 h-3.5" />
                    <span>Powered by GitHub</span>
                  </div>
                  <span className="text-xs text-text-secondary/30 font-mono">
                    chapa.thecreativetoken.com/u/developer
                  </span>
                </div>
              </div>
            </div>

            {/* Terminal snippet */}
            <div className="mt-10 mx-auto max-w-lg">
              <div className="rounded-xl border border-stroke bg-[#0a0e13] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
                  <div className="w-3 h-3 rounded-full bg-white/[0.06]" />
                  <div className="w-3 h-3 rounded-full bg-white/[0.06]" />
                  <div className="w-3 h-3 rounded-full bg-white/[0.06]" />
                  <span className="ml-2 text-xs text-text-secondary/40 font-mono">
                    embed snippet
                  </span>
                </div>
                <div className="p-4 font-mono text-sm leading-relaxed">
                  <p className="text-text-secondary/60">
                    <span className="text-mint/70">{"<!-- "}</span>
                    Add to your README
                    <span className="text-mint/70">{" -->"}</span>
                  </p>
                  <p className="text-text-primary/80 mt-1">
                    <span className="text-mint">{"![Impact Badge]("}</span>
                    <span className="text-text-secondary">
                      {"chapa.thecreativetoken.com/u/"}
                    </span>
                    <span className="text-mint/70">{"developer"}</span>
                    <span className="text-mint">{"/badge.svg)"}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────── */}
        <section id="features" className="py-32 border-t border-stroke/50">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                Built for developers
                <br />
                <span className="text-mint">who ship</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-stroke bg-card/50 p-8 transition-all hover:border-mint/20 hover:bg-card"
                >
                  <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-mint/[0.08] border border-mint/10 text-mint transition-colors group-hover:bg-mint/15">
                    {ICON_MAP[feature.icon]}
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-3">
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

        {/* ── How It Works ──────────────────────────────── */}
        <section id="how-it-works" className="py-32 border-t border-stroke/50">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center mb-16">
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl tracking-tight">
                Three steps.{" "}
                <span className="text-mint">That&apos;s it.</span>
              </h2>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
              {/* Connecting line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-[1px] bg-gradient-to-r from-stroke via-mint/20 to-stroke" />

              {STEPS.map((step) => (
                <div key={step.number} className="relative text-center">
                  <div className="relative z-10 inline-flex items-center justify-center w-24 h-24 rounded-full border border-stroke bg-card mb-8">
                    <span className="text-2xl font-heading text-mint">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-3">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────── */}
        <section className="py-32 border-t border-stroke/50">
          <div className="mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-stroke bg-card/50 p-10 text-center"
                >
                  <p className="text-5xl md:text-6xl font-heading tracking-tight text-mint">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-text-secondary">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────── */}
        <section className="relative py-32 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-mint/[0.05] blur-[140px]" />

          <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
            <h2 className="font-heading text-4xl sm:text-5xl md:text-6xl tracking-tight">
              Ready to prove
              <br />
              <span className="text-mint">your impact?</span>
            </h2>
            <p className="mt-6 text-text-secondary text-lg max-w-xl mx-auto">
              Join thousands of developers showcasing their real contributions.
              It takes 30 seconds.
            </p>
            <div className="mt-10">
              <a
                href="/api/auth/github"
                className="group inline-flex items-center gap-2.5 rounded-full bg-mint px-10 py-4 text-lg font-semibold text-bg transition-all hover:shadow-xl hover:shadow-mint/25 animate-pulse-glow"
              >
                <GitHubIcon className="w-5 h-5" />
                Get Your Badge
                <ArrowRightIcon className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-stroke/50 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="font-heading text-lg tracking-tight">
                Chapa<span className="text-mint">.</span>
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
                className="text-text-secondary/40 hover:text-text-secondary transition-colors"
                aria-label="GitHub"
              >
                <GitHubIcon className="w-5 h-5" />
              </a>
              <a
                href="https://x.com"
                className="text-text-secondary/40 hover:text-text-secondary transition-colors"
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
    </>
  );
}

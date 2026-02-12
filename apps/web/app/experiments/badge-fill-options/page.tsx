/* ── Badge Fill Options — Comparison Page ─────────────────────
   Three variants for filling the empty space below the stats cards.
   Temporary experiment page for visual comparison. */

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

const HEATMAP: number[][] = [
  [0, 2, 3, 2, 1, 0, 0], [1, 3, 4, 3, 2, 1, 0], [2, 4, 3, 4, 3, 0, 0],
  [1, 2, 4, 3, 2, 1, 0], [0, 1, 2, 3, 2, 0, 0], [3, 4, 4, 3, 4, 1, 0],
  [2, 3, 2, 4, 3, 0, 1], [1, 2, 3, 2, 1, 0, 0], [0, 3, 4, 4, 3, 1, 0],
  [2, 4, 3, 2, 4, 0, 0], [1, 3, 4, 3, 2, 1, 0], [3, 4, 2, 4, 3, 0, 1],
  [2, 3, 4, 3, 2, 1, 0],
];

const HEATMAP_COLORS: Record<number, string> = {
  0: "bg-amber/[0.04]", 1: "bg-amber/15", 2: "bg-amber/30", 3: "bg-amber/55", 4: "bg-amber/85",
};

/* ── Shared badge shell ───────────────────────────────────────── */

function BadgeShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div>
      <h2 className="font-heading text-lg text-amber mb-4">{label}</h2>
      <div data-theme="dark" className="relative rounded-xl border border-stroke bg-[#111118] shadow-2xl shadow-black/30 overflow-hidden">
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber/30 to-transparent" />
        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center">
                <GitHubIcon className="w-5 h-5 text-amber" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-text-primary">@developer</p>
                  <svg className="w-3.5 h-3.5 text-amber opacity-40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
                  </svg>
                </div>
                <p className="text-sm text-text-secondary">Last 12 months</p>
              </div>
            </div>
            <span className="text-sm font-heading text-text-primary/60 tracking-tight">
              Chapa<span className="text-amber">_</span>
            </span>
          </div>

          {/* Body */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            {/* Heatmap */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-text-primary/50 mb-2">
                Activity
              </p>
              <div className="grid grid-cols-13 grid-rows-7 grid-flow-col gap-1">
                {HEATMAP.map((week, wi) =>
                  week.map((level, di) => (
                    <div
                      key={`${wi}-${di}`}
                      className={`aspect-square rounded-[2px] ${HEATMAP_COLORS[level]} transition-colors`}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Score + variant content */}
            {children}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-primary/50">
              <GitHubIcon className="w-3.5 h-3.5" />
              <span>Powered by GitHub</span>
            </div>
            <span className="text-xs text-text-primary/50 font-heading">
              chapa.thecreativetoken.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared stat card ─────────────────────────────────────────── */

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-3 text-center">
      <span className="block text-2xl font-heading font-bold tracking-tight text-text-primary leading-none">
        {value}
      </span>
      <span className="block text-[10px] uppercase tracking-wider text-text-secondary mt-1.5">
        {label}
      </span>
    </div>
  );
}

/* ── Score header (shared by all variants) ────────────────────── */

function ScoreHeader() {
  return (
    <>
      <p className="text-[10px] tracking-widest uppercase text-text-primary/50 mb-1">
        Impact Score
      </p>
      <div className="flex items-end gap-3">
        <span className="text-6xl font-heading tracking-tighter text-text-primary leading-none">
          94
        </span>
        <div className="flex flex-col gap-1 pb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 border border-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber w-fit">
            <StarIcon className="w-3 h-3" />
            Elite
          </span>
          <span className="text-xs text-text-secondary">
            87% Confidence
          </span>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPTION A — Second row of stat cards (Active Days, Repos, Issues)
   ══════════════════════════════════════════════════════════════════ */

function OptionA() {
  return (
    <BadgeShell label="Option A — Second Row of Stat Cards">
      <div className="w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col">
        <ScoreHeader />

        {/* Row 1: core stats */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard value="847" label="commits" />
          <StatCard value="42" label="PRs merged" />
          <StatCard value="28" label="reviews" />
        </div>

        {/* Row 2: additional stats */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatCard value="45" label="active days" />
          <StatCard value="4" label="repos" />
          <StatCard value="5" label="issues" />
        </div>
      </div>
    </BadgeShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPTION B — Lines of Code Bar
   ══════════════════════════════════════════════════════════════════ */

function OptionB() {
  const added = 4200;
  const deleted = 1100;
  const total = added + deleted;
  const addedPct = Math.round((added / total) * 100);

  return (
    <BadgeShell label="Option B — Lines of Code Breakdown">
      <div className="w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col">
        <ScoreHeader />

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard value="847" label="commits" />
          <StatCard value="42" label="PRs merged" />
          <StatCard value="28" label="reviews" />
        </div>

        {/* Lines of code */}
        <div className="mt-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary">
              Lines changed
            </span>
            <span className="text-xs font-heading text-text-secondary">
              {(added + deleted).toLocaleString()}
            </span>
          </div>
          {/* Stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
            <div
              className="bg-terminal-green/70 rounded-l-full"
              style={{ width: `${addedPct}%` }}
            />
            <div
              className="bg-terminal-red/50 rounded-r-full"
              style={{ width: `${100 - addedPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs">
            <span className="text-terminal-green font-heading font-semibold">
              +{added.toLocaleString()}
            </span>
            <span className="text-terminal-red font-heading font-semibold">
              -{deleted.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </BadgeShell>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPTION C — Impact Breakdown Bar
   ══════════════════════════════════════════════════════════════════ */

function OptionC() {
  const breakdown = [
    { label: "Commits", value: 0.71, color: "bg-amber" },
    { label: "PR Weight", value: 0.55, color: "bg-amber-light" },
    { label: "Reviews", value: 0.52, color: "bg-complement" },
    { label: "Issues", value: 0.17, color: "bg-terminal-yellow" },
    { label: "Streak", value: 0.50, color: "bg-terminal-green" },
  ];

  return (
    <BadgeShell label="Option C — Impact Breakdown">
      <div className="w-[40%] sm:w-[320px] flex-shrink-0 flex flex-col">
        <ScoreHeader />

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard value="847" label="commits" />
          <StatCard value="42" label="PRs merged" />
          <StatCard value="28" label="reviews" />
        </div>

        {/* Impact breakdown */}
        <div className="mt-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-3">
          <span className="block text-[10px] uppercase tracking-wider text-text-secondary mb-2.5">
            Score Breakdown
          </span>
          <div className="space-y-2">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary w-16 shrink-0 text-right">
                  {item.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.value * 100}%`, opacity: 0.8 }}
                  />
                </div>
                <span className="text-[10px] font-heading text-text-secondary w-6 tabular-nums">
                  {Math.round(item.value * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BadgeShell>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function BadgeFillOptionsPage() {
  return (
    <div className="bg-bg min-h-screen text-text-primary">
      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        <div>
          <h1 className="font-heading text-3xl tracking-tight mb-2">
            Badge Fill Options
          </h1>
          <p className="text-text-secondary text-sm">
            Three variants for the empty space below the stat cards. Pick your favorite.
          </p>
        </div>

        <OptionA />
        <OptionB />
        <OptionC />
      </div>
    </div>
  );
}

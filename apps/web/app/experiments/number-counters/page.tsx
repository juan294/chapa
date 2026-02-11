"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from "react";

/* ------------------------------------------------------------------ */
/*  Easing functions                                                   */
/* ------------------------------------------------------------------ */

type EasingFn = (t: number) => number;

const easings: Record<string, EasingFn> = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

const EASING_NAMES: Record<string, string> = {
  linear: "Linear",
  easeOut: "Ease Out",
  easeInOut: "Ease In-Out",
  spring: "Spring",
};

/* ------------------------------------------------------------------ */
/*  useAnimatedCounter                                                 */
/* ------------------------------------------------------------------ */

function useAnimatedCounter(
  target: number,
  duration: number = 2000,
  easing: string = "easeOut",
  startOnMount: boolean = false,
) {
  const [value, setValue] = useState(startOnMount ? 0 : target);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number>(0);
  const prefersReducedMotion = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const runAnimation = useCallback(
    (t: number, dur: number, ease: string) => {
      cancelAnimationFrame(rafRef.current);

      if (prefersReducedMotion.current) {
        setValue(t);
        return;
      }

      setIsAnimating(true);
      setValue(0);
      const start = performance.now();
      const easeFn = easings[ease] || easings.easeOut;

      const frame = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / dur, 1);
        const easedProgress = easeFn(progress);
        setValue(Math.round(easedProgress * t));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          setValue(t);
          setIsAnimating(false);
        }
      };

      rafRef.current = requestAnimationFrame(frame);
    },
    [],
  );

  const animate = useCallback(() => {
    runAnimation(target, duration, easing);
  }, [runAnimation, target, duration, easing]);

  // Start on mount via rAF (not synchronous setState in effect)
  useEffect(() => {
    if (startOnMount && !mountedRef.current) {
      mountedRef.current = true;
      const id = requestAnimationFrame(() => {
        runAnimation(target, duration, easing);
      });
      return () => cancelAnimationFrame(id);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, isAnimating, animate };
}

/* ------------------------------------------------------------------ */
/*  useInView                                                          */
/* ------------------------------------------------------------------ */

function useInView(ref: RefObject<HTMLElement | null>, threshold = 0.5) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return inView;
}

/* ------------------------------------------------------------------ */
/*  Inline SVG Icons                                                   */
/* ------------------------------------------------------------------ */

function ReplayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 0L12 6L6 12L0 6Z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 1 — Hero Score Counter                                     */
/* ------------------------------------------------------------------ */

function HeroSection({
  globalEasing,
  globalDuration,
  globalTarget,
  replayKey,
}: {
  globalEasing: string;
  globalDuration: number;
  globalTarget: number;
  replayKey: number;
}) {
  const hero = useAnimatedCounter(globalTarget, globalDuration, globalEasing, true);

  // Replay when replayKey changes
  const prevReplayKey = useRef(replayKey);
  useEffect(() => {
    if (replayKey !== prevReplayKey.current) {
      prevReplayKey.current = replayKey;
      hero.animate();
    }
  }, [replayKey, hero]);

  // Also re-animate when settings change
  const prevEasing = useRef(globalEasing);
  const prevDuration = useRef(globalDuration);
  const prevTarget = useRef(globalTarget);
  useEffect(() => {
    if (
      globalEasing !== prevEasing.current ||
      globalDuration !== prevDuration.current ||
      globalTarget !== prevTarget.current
    ) {
      prevEasing.current = globalEasing;
      prevDuration.current = globalDuration;
      prevTarget.current = globalTarget;
      hero.animate();
    }
  }, [globalEasing, globalDuration, globalTarget, hero]);

  return (
    <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 md:p-12">
      {/* Eyebrow */}
      <p className="mb-4 text-sm font-medium tracking-widest text-amber uppercase">
        Impact Score
      </p>
      <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        Hero Counter
      </h2>

      {/* Big number */}
      <div className="flex items-center justify-center py-8">
        <div className="relative">
          {/* Ambient glow */}
          <div className="absolute inset-0 -m-8 rounded-full bg-amber/[0.06] blur-[80px]" />
          <span
            className="font-heading relative text-8xl font-extrabold tracking-tight text-amber sm:text-9xl"
            aria-live="polite"
            aria-label={`Impact score: ${hero.value}`}
          >
            {hero.value}
          </span>
        </div>
      </div>

      {/* Replay button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={hero.animate}
          className="flex items-center gap-2 rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
        >
          <ReplayIcon />
          Replay
        </button>
      </div>

      {/* Easing comparison row */}
      <div className="mt-12 border-t border-warm-stroke pt-8">
        <p className="mb-6 text-center text-sm font-medium text-text-secondary">
          Easing Comparison
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.keys(easings).map((name) => (
            <EasingPreview
              key={`${name}-${replayKey}-${globalTarget}-${globalDuration}`}
              name={name}
              target={globalTarget}
              duration={globalDuration}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EasingPreview({
  name,
  target,
  duration,
}: {
  name: string;
  target: number;
  duration: number;
}) {
  const counter = useAnimatedCounter(target, duration, name, true);

  return (
    <div className="rounded-xl border border-warm-stroke bg-[#0d0b08] p-4 text-center">
      <span className="font-heading text-2xl font-bold text-amber sm:text-3xl">
        {counter.value}
      </span>
      <p className="mt-1 text-xs text-text-secondary">{EASING_NAMES[name]}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2 — Stats Row Counters                                     */
/* ------------------------------------------------------------------ */

interface StatDef {
  label: string;
  value: number;
  suffix: string;
  delay: number;
}

const STATS: StatDef[] = [
  { label: "Commits", value: 523, suffix: " commits", delay: 0 },
  { label: "PRs Merged", value: 47, suffix: " PRs merged", delay: 200 },
  { label: "Reviews", value: 89, suffix: " reviews", delay: 400 },
];

function StatsSection({
  globalEasing,
  globalDuration,
}: {
  globalEasing: string;
  globalDuration: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, 0.3);

  return (
    <div
      ref={sectionRef}
      className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 md:p-12"
    >
      <p className="mb-4 text-sm font-medium tracking-widest text-amber uppercase">
        Activity
      </p>
      <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        Stats Row Counters
      </h2>
      <p className="mb-8 leading-relaxed text-text-secondary">
        These counters trigger when scrolled into view, with staggered delays
        for a cascading effect.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <StatCard
            key={stat.label}
            stat={stat}
            inView={inView}
            easing={globalEasing}
            duration={globalDuration}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  stat,
  inView,
  easing,
  duration,
}: {
  stat: StatDef;
  inView: boolean;
  easing: string;
  duration: number;
}) {
  const counter = useAnimatedCounter(stat.value, duration, easing, false);
  const triggered = useRef(false);

  useEffect(() => {
    if (inView && !triggered.current) {
      triggered.current = true;
      const timer = setTimeout(() => counter.animate(), stat.delay);
      return () => clearTimeout(timer);
    }
  }, [inView, counter, stat.delay]);

  return (
    <div className="rounded-xl border border-warm-stroke bg-[#0d0b08] p-6 text-center transition-all hover:border-amber/20 hover:bg-warm-card">
      <span className="font-heading text-4xl font-bold text-amber sm:text-5xl">
        {counter.value}
      </span>
      <p className="mt-2 text-sm font-medium text-text-secondary">
        {stat.label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3 — Confidence Percentage                                  */
/* ------------------------------------------------------------------ */

function ConfidenceSection({
  globalEasing,
  globalDuration,
}: {
  globalEasing: string;
  globalDuration: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, 0.5);
  const counter = useAnimatedCounter(82, globalDuration, globalEasing, false);
  const triggered = useRef(false);

  useEffect(() => {
    if (inView && !triggered.current) {
      triggered.current = true;
      counter.animate();
    }
  }, [inView, counter]);

  return (
    <div
      ref={sectionRef}
      className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 md:p-12"
    >
      <p className="mb-4 text-sm font-medium tracking-widest text-amber uppercase">
        Confidence
      </p>
      <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        Progress Bar Counter
      </h2>
      <p className="mb-8 leading-relaxed text-text-secondary">
        The bar fills in sync with the number count, creating a unified
        animation.
      </p>

      <div className="mx-auto max-w-lg">
        {/* Number */}
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-heading text-5xl font-bold text-amber sm:text-6xl">
            {counter.value}
            <span className="text-3xl text-amber/70 sm:text-4xl">%</span>
          </span>
          <span className="text-sm font-medium text-text-secondary">
            Confidence
          </span>
        </div>

        {/* Track */}
        <div className="h-4 overflow-hidden rounded-full bg-[#0d0b08] border border-warm-stroke">
          {/* Fill */}
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${(counter.value / 82) * 100}%`,
              background:
                "linear-gradient(90deg, #5E4FCC 0%, #7C6AEF 60%, #9D8FFF 100%)",
            }}
          />
        </div>

        {/* Scale markers */}
        <div className="mt-2 flex justify-between px-0.5">
          {[0, 25, 50, 75, 100].map((v) => (
            <span key={v} className="text-xs text-text-secondary/50">
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 4 — Controls                                               */
/* ------------------------------------------------------------------ */

function ControlsSection({
  easing,
  setEasing,
  duration,
  setDuration,
  target,
  setTarget,
  onReplayAll,
}: {
  easing: string;
  setEasing: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  target: number;
  setTarget: (v: number) => void;
  onReplayAll: () => void;
}) {
  return (
    <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 md:p-12">
      <p className="mb-4 text-sm font-medium tracking-widest text-amber uppercase">
        Playground
      </p>
      <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        Controls
      </h2>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {/* Easing selector */}
        <div>
          <label className="mb-3 block text-sm font-medium text-text-secondary">
            Easing Function
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(easings).map((name) => (
              <button
                key={name}
                onClick={() => setEasing(name)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  easing === name
                    ? "border-amber bg-amber/10 text-amber"
                    : "border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                }`}
              >
                {EASING_NAMES[name]}
              </button>
            ))}
          </div>
        </div>

        {/* Duration slider */}
        <div>
          <label className="mb-3 block text-sm font-medium text-text-secondary">
            Duration:{" "}
            <span className="font-heading text-text-primary">
              {duration}ms
            </span>
          </label>
          <input
            type="range"
            min={500}
            max={4000}
            step={100}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-amber"
          />
          <div className="mt-1 flex justify-between text-xs text-text-secondary/50">
            <span>500ms</span>
            <span>4000ms</span>
          </div>
        </div>

        {/* Target value */}
        <div>
          <label className="mb-3 block text-sm font-medium text-text-secondary">
            Target Value
          </label>
          <input
            type="number"
            min={1}
            max={9999}
            value={target}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= 9999) setTarget(v);
            }}
            className="font-heading w-full rounded-lg border border-warm-stroke bg-[#0d0b08] px-4 py-2.5 text-lg text-text-primary outline-none transition-colors focus:border-amber"
          />
        </div>
      </div>

      {/* Replay all */}
      <div className="mt-10 flex justify-center">
        <button
          onClick={onReplayAll}
          className="flex items-center gap-2 rounded-full bg-amber px-8 py-3.5 text-base font-semibold text-warm-bg transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
        >
          <ReplayIcon />
          Replay All
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function NumberCountersPage() {
  const [easing, setEasing] = useState("easeOut");
  const [duration, setDuration] = useState(2000);
  const [target, setTarget] = useState(87);
  const [replayKey, setReplayKey] = useState(0);

  const handleReplayAll = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  return (
    <div className="relative min-h-screen bg-bg">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-amber/[0.03] blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 sm:py-24">
        {/* Page header */}
        <header className="mb-16 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <DiamondIcon className="text-amber/40" />
            <span className="text-sm font-medium tracking-widest text-amber/60 uppercase">
              Experiment #44
            </span>
            <DiamondIcon className="text-amber/40" />
          </div>
          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            Animated Number{" "}
            <span className="text-amber">Counters</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-text-secondary">
            Count-up animations with configurable easing, duration, and
            scroll-triggered reveals.
          </p>
        </header>

        {/* Sections */}
        <div className="space-y-8">
          <HeroSection
            globalEasing={easing}
            globalDuration={duration}
            globalTarget={target}
            replayKey={replayKey}
          />

          <StatsSection globalEasing={easing} globalDuration={duration} />

          <ConfidenceSection globalEasing={easing} globalDuration={duration} />

          <ControlsSection
            easing={easing}
            setEasing={setEasing}
            duration={duration}
            setDuration={setDuration}
            target={target}
            setTarget={setTarget}
            onReplayAll={handleReplayAll}
          />
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-warm-stroke pt-8 text-center">
          <p className="text-sm text-text-secondary/60">
            Chapa Experiments{" "}
            <span className="text-amber/40 mx-1">/</span> #44 Number Counters
          </p>
        </footer>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeContent, getBadgeContentCSS } from "@/components/badge/BadgeContent";
import { MOCK_STATS, MOCK_IMPACT } from "../__fixtures__/mock-data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  /** Phase offset for sparkle oscillation */
  phase: number;
}

interface ParticleConfig {
  count: number;
  colors: string[];
  minRadius: number;
  maxRadius: number;
  speed: number;
  minOpacity: number;
  maxOpacity: number;
  connections: boolean;
  connectionDistance: number;
  mouseRepulsion: boolean;
  mouseRadius: number;
  /** If true, opacity oscillates over time (sparkle effect) */
  sparkle: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hex to RGB helper                                                  */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 124, g: 106, b: 239 }; // fallback to amber
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/* ------------------------------------------------------------------ */
/*  Particle Canvas hook                                               */
/* ------------------------------------------------------------------ */

function useParticles(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: ParticleConfig,
) {
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas for retina
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Init particles
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    particlesRef.current = Array.from({ length: config.count }, () => {
      const baseOpacity =
        config.minOpacity +
        Math.random() * (config.maxOpacity - config.minOpacity);
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        radius:
          config.minRadius +
          Math.random() * (config.maxRadius - config.minRadius),
        opacity: baseOpacity,
        baseOpacity,
        color: config.colors[Math.floor(Math.random() * config.colors.length)]!,
        phase: Math.random() * Math.PI * 2,
      };
    });

    // Mouse tracking
    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleLeave);

    // Pre-compute RGB values for each color
    const colorRgbMap = new Map<string, { r: number; g: number; b: number }>();
    for (const c of config.colors) {
      colorRgbMap.set(c, hexToRgb(c));
    }

    // Animation loop
    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      ctx.clearRect(0, 0, cw, ch);

      const particles = particlesRef.current;
      timeRef.current += 0.016; // ~60fps
      const t = timeRef.current;

      for (const p of particles) {
        // Mouse repulsion
        if (config.mouseRepulsion) {
          const dx = p.x - mouseRef.current.x;
          const dy = p.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < config.mouseRadius && dist > 0) {
            const force = (config.mouseRadius - dist) / config.mouseRadius;
            p.vx += (dx / dist) * force * 0.5;
            p.vy += (dy / dist) * force * 0.5;
          }
        }

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Damping
        p.vx *= 0.995;
        p.vy *= 0.995;

        // Re-inject minimum velocity so particles never fully stop
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const minSpeed = config.speed * 0.15;
        if (speed < minSpeed) {
          const angle = Math.random() * Math.PI * 2;
          p.vx += Math.cos(angle) * minSpeed * 0.5;
          p.vy += Math.sin(angle) * minSpeed * 0.5;
        }

        // Wrap around edges (softer than bouncing)
        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;
        if (p.y < -10) p.y = ch + 10;
        if (p.y > ch + 10) p.y = -10;

        // Sparkle: oscillating opacity
        if (config.sparkle) {
          p.opacity =
            p.baseOpacity *
            (0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + p.phase)));
        }

        // Draw particle
        const rgb = colorRgbMap.get(p.color) ?? { r: 124, g: 106, b: 239 };
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
        ctx.fill();
      }

      // Draw connections
      if (config.connections) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i]!.x - particles[j]!.x;
            const dy = particles[i]!.y - particles[j]!.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < config.connectionDistance) {
              const opacity =
                (1 - dist / config.connectionDistance) * 0.15;
              ctx.beginPath();
              ctx.moveTo(particles[i]!.x, particles[i]!.y);
              ctx.lineTo(particles[j]!.x, particles[j]!.y);
              ctx.strokeStyle = `rgba(124, 106, 239, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!prefersReducedMotion) {
      animate();
    } else {
      // Draw particles once, static
      const particles = particlesRef.current;
      for (const p of particles) {
        const rgb = colorRgbMap.get(p.color) ?? { r: 124, g: 106, b: 239 };
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
        ctx.fill();
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleLeave);
    };
  }, [canvasRef, config]);
}

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random for heatmap                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mock Badge Card                                                    */
/* ------------------------------------------------------------------ */

function MockBadgeCard() {
  return (
    <div className="relative rounded-2xl border border-stroke bg-card/90 backdrop-blur-sm p-6 w-full max-w-sm">
      <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section with particles behind badge                                */
/* ------------------------------------------------------------------ */

function ParticleSection({
  title,
  description,
  config,
  height = "h-[420px]",
}: {
  title: string;
  description: string;
  config: ParticleConfig;
  height?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useParticles(canvasRef, config);

  return (
    <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
      <div className="p-6 border-b border-stroke">
        <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
          {title}
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
      </div>
      <div className={`relative ${height} bg-bg`}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-auto"
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <MockBadgeCard />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive Playground                                             */
/* ------------------------------------------------------------------ */

type ColorPreset = "amber" | "gold" | "mixed";

const COLOR_PRESETS: Record<ColorPreset, string[]> = {
  amber: ["#7C6AEF"],
  gold: ["#9D8FFF", "#7C6AEF"],
  mixed: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
};

function PlaygroundSection() {
  const [count, setCount] = useState(50);
  const [speed, setSpeed] = useState(0.4);
  const [minRadius, setMinRadius] = useState(1);
  const [maxRadius, setMaxRadius] = useState(3);
  const [connections, setConnections] = useState(false);
  const [mouseRepulsion, setMouseRepulsion] = useState(true);
  const [colorPreset, setColorPreset] = useState<ColorPreset>("mixed");

  // Build config from state -- use a stable reference via JSON key
  const config: ParticleConfig = {
    count,
    colors: COLOR_PRESETS[colorPreset],
    minRadius,
    maxRadius,
    speed,
    minOpacity: 0.1,
    maxOpacity: 0.4,
    connections,
    connectionDistance: 150,
    mouseRepulsion,
    mouseRadius: 120,
    sparkle: false,
  };

  // We need to remount the canvas when config changes to reinit particles.
  // Use a key derived from config values.
  const configKey = `${count}-${speed}-${minRadius}-${maxRadius}-${connections}-${mouseRepulsion}-${colorPreset}`;

  return (
    <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
      <div className="p-6 border-b border-stroke">
        <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
          Interactive Playground
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Tweak the parameters and interact with the canvas. Move your mouse
          over the particles.
        </p>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-stroke bg-card/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Particle count */}
          <div>
            <label
              htmlFor="pg-count"
              className="block text-text-secondary text-sm mb-2"
            >
              Particles:{" "}
              <span className="text-amber font-semibold">{count}</span>
            </label>
            <input
              id="pg-count"
              type="range"
              min={10}
              max={150}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>10</span>
              <span>150</span>
            </div>
          </div>

          {/* Speed */}
          <div>
            <label
              htmlFor="pg-speed"
              className="block text-text-secondary text-sm mb-2"
            >
              Speed:{" "}
              <span className="text-amber font-semibold">
                {speed.toFixed(1)}
              </span>
            </label>
            <input
              id="pg-speed"
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>0.1</span>
              <span>1.0</span>
            </div>
          </div>

          {/* Min/Max Radius */}
          <div>
            <label
              htmlFor="pg-min-radius"
              className="block text-text-secondary text-sm mb-2"
            >
              Size:{" "}
              <span className="text-amber font-semibold">
                {minRadius}-{maxRadius}px
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="pg-min-radius"
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={minRadius}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinRadius(v);
                  if (v > maxRadius) setMaxRadius(v);
                }}
                className="w-full accent-amber"
              />
              <input
                type="range"
                min={0.5}
                max={8}
                step={0.5}
                value={maxRadius}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxRadius(v);
                  if (v < minRadius) setMinRadius(v);
                }}
                className="w-full accent-amber"
                aria-label="Max radius"
              />
            </div>
          </div>

          {/* Color preset */}
          <div>
            <p className="text-text-secondary text-sm mb-2">Color Preset</p>
            <div className="flex gap-2">
              {(["amber", "gold", "mixed"] as ColorPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColorPreset(p)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    colorPreset === p
                      ? "bg-amber text-white"
                      : "border border-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <ToggleSwitch
              id="pg-connections"
              label="Connections"
              checked={connections}
              onChange={setConnections}
            />
            <ToggleSwitch
              id="pg-mouse"
              label="Mouse Repulsion"
              checked={mouseRepulsion}
              onChange={setMouseRepulsion}
            />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <PlaygroundCanvas key={configKey} config={config} />
    </section>
  );
}

function PlaygroundCanvas({ config }: { config: ParticleConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useParticles(canvasRef, config);

  return (
    <div className="relative h-[460px] bg-bg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <MockBadgeCard />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors ${
            checked ? "bg-amber" : "bg-stroke"
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-text-primary transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Row                                                         */
/* ------------------------------------------------------------------ */

function DetailRow({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-heading text-sm font-bold text-amber mb-1">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed font-body">
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preset configs                                                     */
/* ------------------------------------------------------------------ */

const DOTS_CONFIG: ParticleConfig = {
  count: 60,
  colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
  minRadius: 1,
  maxRadius: 3,
  speed: 0.3,
  minOpacity: 0.1,
  maxOpacity: 0.35,
  connections: false,
  connectionDistance: 0,
  mouseRepulsion: false,
  mouseRadius: 0,
  sparkle: false,
};

const CONSTELLATION_CONFIG: ParticleConfig = {
  count: 40,
  colors: ["#7C6AEF", "#9D8FFF"],
  minRadius: 1,
  maxRadius: 2.5,
  speed: 0.25,
  minOpacity: 0.15,
  maxOpacity: 0.4,
  connections: true,
  connectionDistance: 150,
  mouseRepulsion: false,
  mouseRadius: 0,
  sparkle: false,
};

const DUST_CONFIG: ParticleConfig = {
  count: 25,
  colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
  minRadius: 2,
  maxRadius: 5,
  speed: 0.1,
  minOpacity: 0.05,
  maxOpacity: 0.15,
  connections: false,
  connectionDistance: 0,
  mouseRepulsion: false,
  mouseRadius: 0,
  sparkle: false,
};

const SPARKLE_CONFIG: ParticleConfig = {
  count: 80,
  colors: ["#7C6AEF", "#9D8FFF", "#E6EDF3"],
  minRadius: 0.5,
  maxRadius: 1.5,
  speed: 0.2,
  minOpacity: 0.1,
  maxOpacity: 0.5,
  connections: false,
  connectionDistance: 0,
  mouseRepulsion: false,
  mouseRadius: 0,
  sparkle: true,
};

const INTERACTIVE_CONFIG: ParticleConfig = {
  count: 50,
  colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
  minRadius: 1,
  maxRadius: 3,
  speed: 0.3,
  minOpacity: 0.1,
  maxOpacity: 0.35,
  connections: true,
  connectionDistance: 120,
  mouseRepulsion: true,
  mouseRadius: 120,
  sparkle: false,
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ParticlesExperimentPage() {
  return (
    <div className="min-h-screen bg-bg">
      <style>{getBadgeContentCSS({}).join("\n")}</style>
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-amber/[0.03] blur-[150px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-amber/[0.04] blur-[120px]"
        aria-hidden="true"
      />

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <header className="mb-12 animate-fade-in-up">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Experiment #49
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-heading text-text-primary tracking-tight mb-4">
            Canvas <span className="text-amber">Particle System</span>
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl">
            Lightweight, custom-built canvas particle system for ambient
            floating particles behind the badge card. Zero external
            dependencies.
          </p>
        </header>

        {/* Preset demos */}
        <div className="space-y-8 mb-12">
          {/* Section 1: Dots */}
          <ParticleSection
            title="1. Floating Dots"
            description="Simple floating amber dots drifting around the badge. Subtle and non-distracting. 60 particles, no connections."
            config={DOTS_CONFIG}
          />

          {/* Section 2: Constellation */}
          <ParticleSection
            title="2. Constellation"
            description="Particles connected by faint lines when close together, forming a web-like network. 40 particles with 150px connection distance."
            config={CONSTELLATION_CONFIG}
          />

          {/* Section 3: Dust Motes */}
          <ParticleSection
            title="3. Golden Dust"
            description="Larger, very transparent particles drifting at minimal speed. Like golden dust motes catching light. 25 particles, 2-5px radius."
            config={DUST_CONFIG}
          />

          {/* Section 4: Sparkles */}
          <ParticleSection
            title="4. Sparkles"
            description="Tiny particles with oscillating opacity creating a twinkling effect. Includes a few white particles for contrast. 80 particles, 0.5-1.5px radius."
            config={SPARKLE_CONFIG}
          />

          {/* Section 5: Mouse Interactive */}
          <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
            <div className="p-6 border-b border-stroke">
              <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
                5. Mouse Interactive
              </h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                Particles gently push away from the cursor. Move your mouse
                over the canvas to see the repulsion effect. 50 particles
                with connections and 120px repulsion radius.
              </p>
            </div>
            <InteractiveCanvasSection config={INTERACTIVE_CONFIG} />
          </section>
        </div>

        {/* Playground */}
        <div className="mb-12">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Playground
          </p>
          <PlaygroundSection />
        </div>

        {/* Implementation notes */}
        <section className="mb-12">
          <p className="text-amber text-sm tracking-widest uppercase mb-4 font-semibold">
            Notes
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mb-6">
            Implementation Details
          </h2>
          <div className="rounded-2xl border border-stroke bg-card/60 p-6 space-y-4">
            <DetailRow
              title="Zero Dependencies"
              text="Entirely custom canvas implementation. No tsParticles, no external libraries. Just requestAnimationFrame and the Canvas 2D API."
            />
            <DetailRow
              title="Retina Support"
              text="Canvas resolution scales with window.devicePixelRatio for crisp rendering on HiDPI displays."
            />
            <DetailRow
              title="Performance"
              text="Particle count capped at reasonable levels (< 150). O(n^2) connection check only runs when connections are enabled. requestAnimationFrame for smooth 60fps."
            />
            <DetailRow
              title="Accessibility"
              text="Canvas is aria-hidden and decorative only. prefers-reduced-motion: reduce renders particles once without animation."
            />
            <DetailRow
              title="Interaction"
              text="Mouse repulsion uses distance-based force with configurable radius. Particles wrap around edges for seamless movement."
            />
            <DetailRow
              title="Compositing"
              text="Canvas sits behind the badge card via absolute positioning. Badge card has pointer-events: none so mouse can reach canvas for interaction."
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-text-secondary text-sm">
          <p>
            Experiment #49 &middot;{" "}
            <span className="text-amber font-medium">
              Custom Canvas 2D
            </span>{" "}
            &middot; Zero external dependencies
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Interactive Canvas Section (mouse-enabled)                         */
/* ------------------------------------------------------------------ */

function InteractiveCanvasSection({ config }: { config: ParticleConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useParticles(canvasRef, config);

  return (
    <div className="relative h-[420px] bg-bg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <MockBadgeCard />
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";

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

export interface ParticleConfig {
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
  if (!result) return { r: 139, g: 92, b: 246 }; // fallback to amber
  return {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
  };
}

/* ------------------------------------------------------------------ */
/*  Particle Canvas hook                                               */
/* ------------------------------------------------------------------ */

export function useParticles(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: ParticleConfig,
) {
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const activeRef = useRef(true);

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

    const stopAnimation = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    // Animation loop
    const animate = () => {
      rafRef.current = 0;
      if (!activeRef.current) return;

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
        const rgb = colorRgbMap.get(p.color) ?? { r: 139, g: 92, b: 246 };
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
              ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (!rafRef.current) animate();
    };

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let isIntersecting = true;
    let isDocumentVisible = document.visibilityState !== "hidden";
    let observer: IntersectionObserver | null = null;

    const syncAnimationState = () => {
      activeRef.current = isIntersecting && isDocumentVisible;
      if (activeRef.current) {
        startAnimation();
      } else {
        stopAnimation();
      }
    };

    const handleVisibilityChange = () => {
      isDocumentVisible = document.visibilityState !== "hidden";
      syncAnimationState();
    };

    if (!prefersReducedMotion) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(([entry]) => {
          isIntersecting = entry?.isIntersecting ?? true;
          syncAnimationState();
        });
        observer.observe(canvas);
      }
      syncAnimationState();
    } else {
      // Draw particles once, static
      const particles = particlesRef.current;
      for (const p of particles) {
        const rgb = colorRgbMap.get(p.color) ?? { r: 139, g: 92, b: 246 };
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
        ctx.fill();
      }
    }

    return () => {
      stopAnimation();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouse);
      canvas.removeEventListener("mouseleave", handleLeave);
    };
  }, [canvasRef, config]);
}

/* ------------------------------------------------------------------ */
/*  Preset configs                                                     */
/* ------------------------------------------------------------------ */

export const DOTS_CONFIG: ParticleConfig = {
  count: 60,
  colors: ["#8B5CF6", "#A78BFA", "#7C3AED"],
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

export const CONSTELLATION_CONFIG: ParticleConfig = {
  count: 40,
  colors: ["#8B5CF6", "#A78BFA"],
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

export const DUST_CONFIG: ParticleConfig = {
  count: 25,
  colors: ["#8B5CF6", "#A78BFA", "#7C3AED"],
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

export const SPARKLE_CONFIG: ParticleConfig = {
  count: 80,
  colors: ["#8B5CF6", "#A78BFA", "#E6EDF3"],
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

export const INTERACTIVE_CONFIG: ParticleConfig = {
  count: 50,
  colors: ["#8B5CF6", "#A78BFA", "#7C3AED"],
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

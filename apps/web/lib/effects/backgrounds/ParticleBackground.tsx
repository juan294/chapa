"use client";

import { useEffect, useRef } from "react";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  baseOpacity: number;
  color: string;
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
  sparkle: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 124, g: 106, b: 239 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function useParticles(
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

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
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        phase: Math.random() * Math.PI * 2,
      };
    });

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };
    canvas.addEventListener("mousemove", handleMouse);
    canvas.addEventListener("mouseleave", handleLeave);

    const colorRgbMap = new Map<string, { r: number; g: number; b: number }>();
    for (const c of config.colors) {
      colorRgbMap.set(c, hexToRgb(c));
    }

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      ctx.clearRect(0, 0, cw, ch);

      const particles = particlesRef.current;
      timeRef.current += 0.016;
      const t = timeRef.current;

      for (const p of particles) {
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

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.995;
        p.vy *= 0.995;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const minSpeed = config.speed * 0.15;
        if (speed < minSpeed) {
          const angle = Math.random() * Math.PI * 2;
          p.vx += Math.cos(angle) * minSpeed * 0.5;
          p.vy += Math.sin(angle) * minSpeed * 0.5;
        }

        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;
        if (p.y < -10) p.y = ch + 10;
        if (p.y > ch + 10) p.y = -10;

        if (config.sparkle) {
          p.opacity =
            p.baseOpacity * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + p.phase)));
        }

        const rgb = colorRgbMap.get(p.color) ?? { r: 124, g: 106, b: 239 };
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
        ctx.fill();
      }

      if (config.connections) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < config.connectionDistance) {
              const opacity = (1 - dist / config.connectionDistance) * 0.15;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(124, 106, 239, ${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!prefersReducedMotion) {
      animate();
    } else {
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

/** Preset particle configs */
export const PARTICLE_PRESETS = {
  dots: {
    count: 60, colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
    minRadius: 1, maxRadius: 3, speed: 0.3, minOpacity: 0.1, maxOpacity: 0.35,
    connections: false, connectionDistance: 0, mouseRepulsion: false, mouseRadius: 0, sparkle: false,
  },
  constellation: {
    count: 40, colors: ["#7C6AEF", "#9D8FFF"],
    minRadius: 1, maxRadius: 2.5, speed: 0.25, minOpacity: 0.15, maxOpacity: 0.4,
    connections: true, connectionDistance: 150, mouseRepulsion: false, mouseRadius: 0, sparkle: false,
  },
  dust: {
    count: 25, colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
    minRadius: 2, maxRadius: 5, speed: 0.1, minOpacity: 0.05, maxOpacity: 0.15,
    connections: false, connectionDistance: 0, mouseRepulsion: false, mouseRadius: 0, sparkle: false,
  },
  sparkle: {
    count: 80, colors: ["#7C6AEF", "#9D8FFF", "#E6EDF3"],
    minRadius: 0.5, maxRadius: 1.5, speed: 0.2, minOpacity: 0.1, maxOpacity: 0.5,
    connections: false, connectionDistance: 0, mouseRepulsion: false, mouseRadius: 0, sparkle: true,
  },
  interactive: {
    count: 50, colors: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
    minRadius: 1, maxRadius: 3, speed: 0.3, minOpacity: 0.1, maxOpacity: 0.35,
    connections: true, connectionDistance: 120, mouseRepulsion: true, mouseRadius: 120, sparkle: false,
  },
} as const satisfies Record<string, ParticleConfig>;

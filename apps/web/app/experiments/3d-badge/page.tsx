"use client";

import dynamic from "next/dynamic";

/* ------------------------------------------------------------------ */
/*  Three.js 3D Interactive Badge — Experiment #51                     */
/*  Renders a 3D badge using React Three Fiber with material presets.  */
/* ------------------------------------------------------------------ */

const Badge3DScene = dynamic(() => import("./Badge3DScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center rounded-2xl border border-warm-stroke bg-warm-card/50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        <p className="text-sm text-text-secondary">Loading 3D scene...</p>
      </div>
    </div>
  ),
});

export default function ThreeDimensionalBadgePage() {
  return (
    <main className="min-h-screen bg-bg bg-grid-warm">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/[0.04] blur-[150px]"
        style={{ width: 600, height: 600 }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-20">
        {/* ── Header ─────────────────────────────────────────── */}
        <p className="mb-4 text-sm font-medium tracking-widest uppercase text-amber">
          Experiment #51
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
          3D Interactive Badge
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          Rotate, zoom, and inspect the Chapa impact badge in 3D space. Switch
          between material presets to explore different card finishes. Drag to
          rotate, scroll to zoom.
        </p>

        {/* ── 3D Scene ───────────────────────────────────────── */}
        <div className="mt-12">
          <Badge3DScene />
        </div>

        {/* ── Controls Legend ─────────────────────────────────── */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C6AEF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3 className="font-heading text-sm font-bold tracking-tight text-text-primary">
              Rotate
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Click and drag to rotate the badge in any direction.
            </p>
          </div>

          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C6AEF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <h3 className="font-heading text-sm font-bold tracking-tight text-text-primary">
              Zoom
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Scroll to zoom in and out. Pinch on touch devices.
            </p>
          </div>

          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C6AEF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 className="font-heading text-sm font-bold tracking-tight text-text-primary">
              Materials
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              Switch between Matte, Metallic, Glossy, and Holographic finishes.
            </p>
          </div>
        </div>

        {/* ── WebGL Note ─────────────────────────────────────── */}
        <p className="mt-8 text-center text-xs text-text-secondary/60">
          Requires WebGL 2.0. Best experienced in Chrome, Edge, or Firefox.
        </p>
      </div>
    </main>
  );
}

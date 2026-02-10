"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Web Component registration hook                                    */
/* ------------------------------------------------------------------ */

function useRegisterChapaBadge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (customElements.get("chapa-badge")) return;

    class ChapaBadge extends HTMLElement {
      private shadow: ShadowRoot;

      static get observedAttributes() {
        return ["handle", "theme", "size"];
      }

      constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
      }

      connectedCallback() {
        this.render();
      }

      attributeChangedCallback() {
        this.render();
      }

      get handle() {
        return this.getAttribute("handle") || "developer";
      }

      get size() {
        return this.getAttribute("size") || "default";
      }

      render() {
        const handle = this.handle;
        const size = this.size;

        const sizes: Record<
          string,
          {
            width: number;
            height: number;
            scoreSize: number;
            gap: number;
            cellSize: number;
          }
        > = {
          compact: {
            width: 400,
            height: 210,
            scoreSize: 36,
            gap: 4,
            cellSize: 10,
          },
          default: {
            width: 600,
            height: 315,
            scoreSize: 56,
            gap: 6,
            cellSize: 14,
          },
          large: {
            width: 800,
            height: 420,
            scoreSize: 72,
            gap: 8,
            cellSize: 18,
          },
        };
        const s = sizes[size] || sizes.default;

        /* Deterministic mock heatmap from handle */
        const heatmapCells = Array.from({ length: 91 }, (_, i) => {
          const seed =
            ((i * 2654435761 + handle.charCodeAt(0) * 1000) >>> 0) % 100;
          if (seed < 60) return 0;
          return Math.min(4, Math.floor(((seed - 60) * 5) / 40));
        });

        const heatmapColors = [
          "rgba(226,168,75,0.06)",
          "rgba(226,168,75,0.20)",
          "rgba(226,168,75,0.38)",
          "rgba(226,168,75,0.58)",
          "rgba(226,168,75,0.85)",
        ];

        let heatmapSvg = "";
        for (let week = 0; week < 13; week++) {
          for (let day = 0; day < 7; day++) {
            const idx = week * 7 + day;
            const level = heatmapCells[idx];
            const x = week * (s.cellSize + s.gap);
            const y = day * (s.cellSize + s.gap);
            heatmapSvg += `<rect x="${x}" y="${y}" width="${s.cellSize}" height="${s.cellSize}" rx="3" fill="${heatmapColors[level]}"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${(week * 0.06).toFixed(2)}s" fill="freeze"/></rect>`;
          }
        }

        const heatmapW = 13 * (s.cellSize + s.gap) - s.gap;
        const heatmapH = 7 * (s.cellSize + s.gap) - s.gap;
        const escapedHandle = this.escapeHtml(handle);

        this.shadow.innerHTML = `
          <style>
            :host {
              display: inline-block;
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            .badge-card {
              width: ${s.width}px;
              height: ${s.height}px;
              background: #1A1610;
              border-radius: 16px;
              border: 1px solid rgba(226,168,75,0.12);
              padding: ${Math.round(s.width * 0.04)}px;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0,0,0,0.3);
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .badge-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(226,168,75,0.08);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: ${Math.round(s.width * 0.03)}px;
            }
            .handle {
              color: #E6EDF3;
              font-size: ${Math.round(s.scoreSize * 0.3)}px;
              font-weight: 500;
            }
            .logo {
              color: #E6EDF3;
              font-size: ${Math.round(s.scoreSize * 0.28)}px;
              font-weight: 700;
              font-family: 'JetBrains Mono', monospace;
            }
            .logo-dot { color: #E2A84B; }
            .body {
              display: flex;
              gap: ${Math.round(s.width * 0.04)}px;
              align-items: center;
            }
            .heatmap-section { flex: 1; }
            .label {
              font-size: ${Math.round(s.scoreSize * 0.18)}px;
              color: #9AA4B2;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin-bottom: ${s.gap * 2}px;
            }
            .score-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .score {
              font-family: 'JetBrains Mono', monospace;
              font-size: ${s.scoreSize}px;
              font-weight: 800;
              background: linear-gradient(90deg, #C28A2E, #E2A84B, #F6E27A, #F6F2C0, #F6E27A, #E2A84B, #C28A2E);
              background-size: 200% 100%;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              animation: shimmer 3s ease-in-out infinite;
            }
            .tier-pill {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 12px;
              border-radius: 999px;
              background: rgba(226,168,75,0.1);
              border: 1px solid rgba(226,168,75,0.2);
              color: #E2A84B;
              font-size: ${Math.round(s.scoreSize * 0.2)}px;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .stats {
              text-align: center;
              color: #9AA4B2;
              font-size: ${Math.round(s.scoreSize * 0.2)}px;
              margin-top: ${Math.round(s.width * 0.03)}px;
            }
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .score { animation: none; }
            }
          </style>
          <div class="badge-card">
            <div class="header">
              <span class="handle">@${escapedHandle}</span>
              <span class="logo">Chapa<span class="logo-dot">.</span></span>
            </div>
            <div class="body">
              <div class="heatmap-section">
                <div class="label">Activity</div>
                <svg width="${heatmapW}" height="${heatmapH}" viewBox="0 0 ${heatmapW} ${heatmapH}">${heatmapSvg}</svg>
              </div>
              <div class="score-section">
                <div class="label">Impact Score</div>
                <div class="tier-pill">\u2605 Elite</div>
                <div class="score">87</div>
              </div>
            </div>
            <div class="stats">523 commits \u00b7 47 PRs \u00b7 89 reviews</div>
          </div>
        `;
      }

      escapeHtml(str: string): string {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
      }
    }

    customElements.define("chapa-badge", ChapaBadge);
  }, []);
}

/* ------------------------------------------------------------------ */
/*  Copy-to-clipboard button                                           */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-warm-stroke px-4 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
      aria-label="Copy to clipboard"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Code block with copy                                               */
/* ------------------------------------------------------------------ */

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="rounded-xl border border-warm-stroke bg-[#0d0b08] overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-warm-stroke px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber/20" aria-hidden="true" />
          <div className="h-3 w-3 rounded-full bg-amber/10" aria-hidden="true" />
          <div className="h-3 w-3 rounded-full bg-amber/[0.06]" aria-hidden="true" />
          <span className="ml-2 text-xs text-text-secondary">{label}</span>
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-heading text-xs leading-relaxed text-text-secondary">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge wrapper (renders custom element via ref)                     */
/* ------------------------------------------------------------------ */

function BadgeDemo({
  handle,
  size,
}: {
  handle: string;
  size?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const sizeAttr = size ? ` size="${size}"` : "";
    ref.current.innerHTML = `<chapa-badge handle="${handle}"${sizeAttr}></chapa-badge>`;
  }, [handle, size]);

  return <div ref={ref} />;
}

/* ------------------------------------------------------------------ */
/*  Background grid pattern                                            */
/* ------------------------------------------------------------------ */

function BackgroundGrid() {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(rgba(226,168,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(226,168,75,0.03) 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WebComponentExperimentPage() {
  useRegisterChapaBadge();

  const [previewHandle, setPreviewHandle] = useState("juan294");
  const [previewSize, setPreviewSize] = useState("default");

  const embedCode = `<!-- Add to your HTML -->
<script src="https://chapa.thecreativetoken.com/embed.js"><\/script>
<chapa-badge handle="${previewHandle}"></chapa-badge>`;

  const embedCodeWithSize = `<chapa-badge handle="${previewHandle}" size="${previewSize}"></chapa-badge>`;

  return (
    <main id="main-content" className="relative min-h-screen bg-bg">
      <BackgroundGrid />

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute rounded-full"
          style={{
            top: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "36rem",
            height: "36rem",
            background: "#E2A84B",
            opacity: 0.03,
            filter: "blur(150px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: "20%",
            right: "15%",
            width: "24rem",
            height: "24rem",
            background: "#C28A2E",
            opacity: 0.04,
            filter: "blur(120px)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        {/* ============================================ */}
        {/*  Header                                      */}
        {/* ============================================ */}
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Experiment #52
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
            Web Component Embed
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary leading-relaxed">
            A custom <code className="font-heading text-amber">&lt;chapa-badge&gt;</code> Web Component
            that developers can embed on any website with two lines of code. Shadow DOM ensures
            complete style isolation from the host page.
          </p>
        </div>

        {/* ============================================ */}
        {/*  Section 1: Live Demo                        */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Live Demo
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Three Sizes
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            The component supports three sizes via the <code className="font-heading text-amber">size</code> attribute.
            Each renders a fully self-contained badge with heatmap, score, and stats.
          </p>

          <div className="flex flex-col items-center gap-10">
            {/* Compact */}
            <div className="flex flex-col items-center gap-3">
              <span className="font-heading text-sm font-bold text-text-primary">
                Compact
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  400 x 210
                </span>
              </span>
              <BadgeDemo handle="juan294" size="compact" />
            </div>

            {/* Default */}
            <div className="flex flex-col items-center gap-3">
              <span className="font-heading text-sm font-bold text-text-primary">
                Default
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  600 x 315
                </span>
              </span>
              <BadgeDemo handle="juan294" size="default" />
            </div>

            {/* Large */}
            <div className="flex flex-col items-center gap-3">
              <span className="font-heading text-sm font-bold text-text-primary">
                Large
                <span className="ml-2 text-xs font-normal text-text-secondary">
                  800 x 420
                </span>
              </span>
              <BadgeDemo handle="juan294" size="large" />
            </div>
          </div>

          {/* Different handles */}
          <div className="mt-16">
            <h3 className="font-heading mb-6 text-lg font-bold text-text-primary">
              Different Handles
            </h3>
            <div className="flex flex-wrap justify-center gap-6">
              {["octocat", "torvalds", "gaearon"].map((h) => (
                <div key={h} className="flex flex-col items-center gap-2">
                  <span className="text-xs text-text-secondary">@{h}</span>
                  <BadgeDemo handle={h} size="compact" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 2: Embed Code                       */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Integration
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Two Lines to Embed
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Add the script tag once, then drop
            <code className="font-heading text-amber"> &lt;chapa-badge&gt;</code> elements
            anywhere in your HTML. No build step, no framework dependency.
          </p>

          <CodeBlock code={embedCode} label="HTML" />

          <div className="mt-6">
            <CodeBlock code={embedCodeWithSize} label="With size attribute" />
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 3: Customization Options             */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            API
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Customization Options
          </h2>

          {/* Interactive preview controls */}
          <div className="mb-10 grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-6 rounded-2xl border border-warm-stroke bg-warm-card/50 p-6">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Try It
              </h3>

              {/* Handle input */}
              <label className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">
                  Handle
                </span>
                <input
                  type="text"
                  value={previewHandle}
                  onChange={(e) => setPreviewHandle(e.target.value)}
                  className="rounded-lg border border-warm-stroke bg-[#0d0b08] px-4 py-2.5 font-heading text-sm text-text-primary outline-none transition-colors focus:border-amber/30"
                  placeholder="GitHub username"
                />
              </label>

              {/* Size selector */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm text-text-secondary">Size</legend>
                <div className="flex gap-2">
                  {["compact", "default", "large"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPreviewSize(s)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                        previewSize === s
                          ? "bg-amber text-warm-bg"
                          : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-lg font-bold text-text-primary">
                Preview
              </h3>
              <div className="flex items-center justify-center overflow-x-auto rounded-2xl border border-warm-stroke bg-warm-card/30 p-6">
                <BadgeDemo
                  handle={previewHandle || "developer"}
                  size={previewSize}
                />
              </div>
            </div>
          </div>

          {/* Attributes table */}
          <div className="overflow-hidden rounded-2xl border border-warm-stroke">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-warm-stroke bg-warm-card/50">
                  <th className="px-6 py-3 font-heading text-xs font-bold uppercase tracking-widest text-amber">
                    Attribute
                  </th>
                  <th className="px-6 py-3 font-heading text-xs font-bold uppercase tracking-widest text-amber">
                    Values
                  </th>
                  <th className="px-6 py-3 font-heading text-xs font-bold uppercase tracking-widest text-amber">
                    Default
                  </th>
                  <th className="px-6 py-3 font-heading text-xs font-bold uppercase tracking-widest text-amber">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-secondary">
                <tr className="border-b border-warm-stroke/50">
                  <td className="px-6 py-4 font-heading text-text-primary">handle</td>
                  <td className="px-6 py-4">string</td>
                  <td className="px-6 py-4">
                    <code className="font-heading text-amber">&quot;developer&quot;</code>
                  </td>
                  <td className="px-6 py-4">GitHub username to display</td>
                </tr>
                <tr className="border-b border-warm-stroke/50">
                  <td className="px-6 py-4 font-heading text-text-primary">size</td>
                  <td className="px-6 py-4">
                    <code className="font-heading">compact</code>,{" "}
                    <code className="font-heading">default</code>,{" "}
                    <code className="font-heading">large</code>
                  </td>
                  <td className="px-6 py-4">
                    <code className="font-heading text-amber">&quot;default&quot;</code>
                  </td>
                  <td className="px-6 py-4">Badge dimensions</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-heading text-text-primary">theme</td>
                  <td className="px-6 py-4">
                    <code className="font-heading">warm</code>
                  </td>
                  <td className="px-6 py-4">
                    <code className="font-heading text-amber">&quot;warm&quot;</code>
                  </td>
                  <td className="px-6 py-4">Color theme (future expansion)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 4: How It Works                     */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Architecture
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            How It Works
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Custom Element",
                body: "Built on the Web Components standard using customElements.define(). Works natively in all modern browsers without polyfills.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                    <line x1="12" y1="22" x2="12" y2="15.5" />
                    <polyline points="22 8.5 12 15.5 2 8.5" />
                  </svg>
                ),
              },
              {
                title: "Shadow DOM",
                body: "All styles are encapsulated inside a Shadow Root. The badge looks identical regardless of the host page's CSS, frameworks, or resets.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
                  </svg>
                ),
              },
              {
                title: "Reactive Attributes",
                body: "Change handle, size, or theme attributes at any time. The component observes changes and re-renders automatically via attributeChangedCallback.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                ),
              },
              {
                title: "XSS Protected",
                body: "All user-controlled text (handle, display name) is escaped through DOM textContent before rendering into the Shadow DOM markup.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
              },
              {
                title: "Zero Dependencies",
                body: "Pure vanilla JavaScript. No React, no jQuery, no build step. The embed script is a single self-contained file estimated at ~5KB gzipped.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12h8" />
                  </svg>
                ),
              },
              {
                title: "API-Powered (Future)",
                body: "In production, the component will fetch real data from the Chapa API. This prototype uses deterministic mock data seeded by the handle.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6 transition-colors hover:border-amber/20 hover:bg-warm-card"
              >
                <div className="mb-3 text-amber">{item.icon}</div>
                <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
                  {item.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================ */}
        {/*  Section 5: Test on Any Background           */}
        {/* ============================================ */}
        <section className="mb-24">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Style Isolation
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Test on Any Background
          </h2>
          <p className="mb-8 max-w-xl text-text-secondary leading-relaxed">
            Shadow DOM ensures the badge looks identical regardless of the host
            page styles. The backgrounds below prove the component is
            fully isolated.
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { label: "White", bg: "#ffffff" },
              { label: "Light Gray", bg: "#f0f0f0" },
              { label: "Dark (Chapa)", bg: "#12100D" },
              { label: "Navy Blue", bg: "#1a1a3e" },
              { label: "Forest Green", bg: "#1a2e1a" },
              { label: "Warm Red", bg: "#2e1a1a" },
            ].map(({ label, bg }) => (
              <div key={label} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-heading text-sm font-bold text-text-primary">
                    {label}
                  </span>
                  <span className="text-xs text-text-secondary">{bg}</span>
                </div>
                <div
                  className="flex items-center justify-center overflow-hidden rounded-2xl border border-warm-stroke p-6"
                  style={{ backgroundColor: bg }}
                >
                  <BadgeDemo handle="juan294" size="compact" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================ */}
        {/*  Observations section                        */}
        {/* ============================================ */}
        <section className="mb-16">
          <p className="mb-4 text-sm uppercase tracking-widest text-amber">
            Findings
          </p>
          <h2 className="font-heading mb-8 text-2xl font-bold tracking-tight text-text-primary">
            Key Observations
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Shadow DOM Works Perfectly",
                body: "Style isolation is complete. Host page CSS (resets, font overrides, box-sizing changes) cannot leak into the badge. This is the primary advantage over iframe embeds.",
              },
              {
                title: "Two-Line Integration",
                body: "The developer experience is minimal: one script tag and one custom element. No npm install, no build configuration, no framework lock-in. Works in any HTML page.",
              },
              {
                title: "Reactive Attribute Updates",
                body: "Changing attributes (handle, size) triggers an immediate re-render via observedAttributes. SPAs can update the badge dynamically without unmounting/remounting.",
              },
              {
                title: "Production Considerations",
                body: "The embed script needs to be a separate bundled JS file served from a CDN. It should fetch real data from the Chapa API with caching headers and handle loading/error states.",
              },
            ].map((finding) => (
              <div
                key={finding.title}
                className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-6"
              >
                <h3 className="font-heading mb-2 text-sm font-bold text-text-primary">
                  {finding.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {finding.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:bg-amber/[0.04] hover:text-text-primary"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

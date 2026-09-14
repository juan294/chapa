// This error boundary replaces the root layout (including Tailwind CSS).
// CSS custom properties and utility classes are NOT available here.
// Hardcoded hex values are intentional — this is the only way to style
// this page since it renders outside the normal component tree.
"use client";

import { useErrorBoundaryReport } from "@/lib/analytics/use-error-boundary-report";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useErrorBoundaryReport(error, "global-error", "global_error");

  return (
    // DEFAULT_LOCALE ('es') — this page can't reach the i18n provider (see note above),
    // so the document lang matches the app default rather than a hardcoded "en".
    <html lang="es">
      <head>
        {/*
          No Tailwind/next-themes here (global-error replaces the root layout), so
          light/dark is done with a plain inline prefers-color-scheme media query.
          Values mirror design-system.md's --color-bg / --color-text-primary /
          --color-text-secondary tokens (light default, dark override).
        */}
        <style>{`
          .global-error-body { background-color: #F4F0E7; color: #1B1B19; }
          .global-error-subtext { color: #64625E; }
          .global-error-title { color: #AA2D1A; }
          .global-error-retry { background-color: #1B1B19; color: #F4F0E7; }
          .global-error-retry:hover { background-color: #AA2D1A; }
          .global-error-home { color: #1B1B19; }
          .global-error-home:hover { background-color: #DCEAF0; }
          .global-error-body :focus-visible { outline: 2px solid #AA2D1A; outline-offset: 4px; }
          @media (prefers-color-scheme: dark) {
            .global-error-body { background-color: #141719; color: #EEEAE1; }
            .global-error-subtext { color: #B3B9B9; }
            .global-error-title { color: #FF927D; }
            .global-error-retry { background-color: #FF795F; color: #17191A; }
            .global-error-retry:hover { background-color: #FF9D88; }
            .global-error-home { color: #EEEAE1; }
            .global-error-home:hover { background-color: #192B35; }
            .global-error-body :focus-visible { outline-color: #FF927D; }
          }
        `}</style>
      </head>
      <body
        className="global-error-body"
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <main
          id="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1
            className="global-error-title"
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              margin: 0,
            }}
          >
            {/* Bilingual: global-error replaces root layout — i18n provider unavailable.
                Each language gets its own lang span rather than one blanket lang="en". */}
            <span lang="es">Algo salió mal</span> / <span lang="en">Something went wrong</span>
          </h1>
          <p
            className="global-error-subtext"
            style={{
              marginTop: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <span lang="es">Ocurrió un error crítico. Por favor, inténtalo de nuevo.</span>{" "}
            / <span lang="en">A critical error occurred. Please try again.</span>
          </p>
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <button
              onClick={reset}
              className="global-error-retry"
              style={{
                borderRadius: "3px",
                minHeight: "44px",
                boxSizing: "border-box",
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid transparent",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <span lang="es">Intentar de nuevo</span> / <span lang="en">Try again</span>
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces root layout; next/link may not be available */}
            <a
              href="/"
              className="global-error-home"
              style={{
                borderRadius: "3px",
                minHeight: "44px",
                boxSizing: "border-box",
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid currentColor",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              <span lang="es">Volver al inicio</span> / <span lang="en">Go home</span>
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

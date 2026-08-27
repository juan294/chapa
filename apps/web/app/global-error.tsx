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
          .global-error-body { background-color: #FFFFFF; color: #1A1A2E; }
          .global-error-subtext { color: #6B7280; }
          @media (prefers-color-scheme: dark) {
            .global-error-body { background-color: #0A0A0F; color: #E2E4E9; }
            .global-error-subtext { color: #6B6F7B; }
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
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              color: "#F87171",
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
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                borderRadius: "8px",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                backgroundColor: "rgba(139, 92, 246, 0.08)",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#8B5CF6",
                cursor: "pointer",
              }}
            >
              <span lang="es">Intentar de nuevo</span> / <span lang="en">Try again</span>
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces root layout; next/link may not be available */}
            <a
              href="/"
              style={{
                borderRadius: "8px",
                border: "1px solid rgba(139, 92, 246, 0.10)",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#6B6F7B",
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

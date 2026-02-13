"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#0A0A0F",
          color: "#E2E4E9",
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
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.875rem",
              color: "#6B6F7B",
            }}
          >
            A critical error occurred. Please try again.
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
                borderRadius: "9999px",
                border: "1px solid rgba(124, 106, 239, 0.3)",
                backgroundColor: "rgba(124, 106, 239, 0.08)",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#7C6AEF",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces root layout; next/link may not be available */}
            <a
              href="/"
              style={{
                borderRadius: "9999px",
                border: "1px solid rgba(124, 106, 239, 0.10)",
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#6B6F7B",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

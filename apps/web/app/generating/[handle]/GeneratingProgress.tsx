"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Step {
  label: string;
  status: "pending" | "active" | "done" | "error";
}

const INITIAL_STEPS: Step[] = [
  { label: "Authenticated with GitHub", status: "done" },
  { label: "Fetching contribution data", status: "active" },
  { label: "Computing Impact profile", status: "pending" },
  { label: "Rendering badge", status: "pending" },
];

const STEP_DELAY_MS = 300;
const REDIRECT_DELAY_MS = 800;

export function GeneratingProgress({ handle }: { handle: string }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const completeRemainingSteps = useCallback(() => {
    // Mark steps 1, 2, 3 as done with staggered delays
    const remaining = [1, 2, 3];
    remaining.forEach((idx, i) => {
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, j) => (j === idx ? { ...s, status: "done" } : s)),
        );
        if (idx === remaining[remaining.length - 1]) {
          setDone(true);
        }
      }, STEP_DELAY_MS * (i + 1));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          credentials: "include",
        });

        if (cancelled) return;

        if (!res.ok) {
          setError("Something went wrong generating your badge.");
          setSteps((prev) =>
            prev.map((s) =>
              s.status === "active" ? { ...s, status: "error" } : s,
            ),
          );
          return;
        }

        completeRemainingSteps();
      } catch {
        if (cancelled) return;
        setError("Something went wrong generating your badge.");
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "active" ? { ...s, status: "error" } : s,
          ),
        );
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [completeRemainingSteps]);

  // Redirect after all steps complete
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      router.push(`/u/${handle}`);
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [done, handle, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md">
        {/* Terminal header */}
        <div className="mb-8 animate-fade-in-up">
          <p className="font-heading text-xs tracking-widest uppercase text-text-secondary">
            <span className="text-terminal-dim">$</span>{" "}
            chapa generate
          </p>
          <h1 className="mt-2 font-heading text-lg font-bold tracking-tight text-text-primary">
            Generating badge for{" "}
            <span className="text-amber">@{handle}</span>
          </h1>
        </div>

        {/* Progress steps */}
        <div
          role="status"
          aria-live="polite"
          className="space-y-3"
        >
          {steps.map((step, i) => (
            <div
              key={step.label}
              data-step={i}
              data-status={step.status}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 font-heading text-sm transition-all duration-300 ${
                step.status === "done"
                  ? "border-terminal-green/20 bg-terminal-green/[0.06]"
                  : step.status === "active"
                    ? "border-amber/20 bg-amber/[0.06]"
                    : step.status === "error"
                      ? "border-terminal-red/20 bg-terminal-red/[0.06]"
                      : "border-stroke bg-card/50"
              }`}
              style={{
                animationDelay: `${i * 100}ms`,
              }}
            >
              {/* Status icon */}
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {step.status === "done" && (
                  <svg
                    className="h-4 w-4 text-terminal-green"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === "active" && (
                  <span className="h-3 w-3 animate-pulse rounded-full bg-amber" />
                )}
                {step.status === "error" && (
                  <svg
                    className="h-4 w-4 text-terminal-red"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {step.status === "pending" && (
                  <span className="h-2 w-2 rounded-full bg-terminal-dim/40" />
                )}
              </span>

              {/* Step label */}
              <span
                className={
                  step.status === "done"
                    ? "text-terminal-green"
                    : step.status === "active"
                      ? "text-amber"
                      : step.status === "error"
                        ? "text-terminal-red"
                        : "text-terminal-dim"
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div role="alert" className="mt-6 animate-terminal-fade-in rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-4">
            <p className="font-heading text-sm text-terminal-red">{error}</p>
            <a
              href={`/generating/${encodeURIComponent(handle)}`}
              className="mt-2 inline-block font-heading text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
            >
              Try again
            </a>
          </div>
        )}

        {/* Redirect notice */}
        {done && (
          <p className="mt-6 animate-terminal-fade-in font-heading text-xs text-text-secondary">
            Redirecting to your badge...
          </p>
        )}
      </div>
    </div>
  );
}

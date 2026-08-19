"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

type StepStatus = "pending" | "active" | "done" | "error";
type ErrorKind = "rateLimited" | "session" | "generic";

const STEP_DELAY_MS = 300;
const REDIRECT_DELAY_MS = 800;
// Generous ceiling: a false timeout (user sees "failed" on a slow-but-working
// request) is worse than a longer worst-case wait. Cold-cache generations
// with large contribution histories are routinely multi-second. (#1108)
const GENERATE_TIMEOUT_MS = 45_000;
// After this long with no response, reassure the user the wait is normal
// progress rather than a freeze. (#1108)
const SLOW_NOTICE_DELAY_MS = 5_000;

export function GeneratingProgress({ handle }: { handle: string }) {
  const router = useRouter();
  const { locale, t } = useTranslation();

  // Step labels derived from dictionary on each render (locale-aware)
  const stepLabels = [
    t('generation.step0') as string,
    t('generation.step1') as string,
    t('generation.step2') as string,
    t('generation.step3') as string,
  ];

  // Step statuses stored as state (driven by API response)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([
    'active', 'pending', 'pending', 'pending',
  ]);
  // Index of the step currently being announced to screen readers via the
  // single live-region status line below (see `liveStatusText`). Updated
  // exactly once per step transition -- never derived from the whole
  // `stepStatuses` array, so a screen reader gets one announcement per
  // transition instead of a burst covering every step (#1114).
  const [announcedStepIndex, setAnnouncedStepIndex] = useState(0);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [done, setDone] = useState(false);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  const retryHref = `/generating/${encodeURIComponent(handle)}?lang=${locale}`;
  // A same-URL retry can't re-authenticate — send the user through the
  // login flow and back to this page instead (#1108).
  const signInAgainHref = `/api/auth/login?redirect=${encodeURIComponent(`/generating/${encodeURIComponent(handle)}`)}`;

  const errorConfig: Record<ErrorKind, { message: string; href: string; linkText: string }> = {
    rateLimited: {
      message: t('generation.errorRateLimited') as string,
      href: retryHref,
      linkText: t('generation.retry') as string,
    },
    session: {
      message: t('generation.errorSession') as string,
      href: signInAgainHref,
      linkText: t('generation.signInAgain') as string,
    },
    generic: {
      message: t('generation.error') as string,
      href: retryHref,
      linkText: t('generation.retry') as string,
    },
  };

  const completeRemainingSteps = useCallback(
    (registerTimer: (id: ReturnType<typeof setTimeout>) => void) => {
      // Complete each step and activate the next one with staggered delays.
      const remaining = [1, 2, 3];
      remaining.forEach((idx, i) => {
        const id = setTimeout(() => {
          setStepStatuses((prev) =>
            prev.map((status, stepIndex) => {
              if (stepIndex === idx) return 'done';
              if (stepIndex === idx + 1) return 'active';
              return status;
            }),
          );
          if (idx === remaining[remaining.length - 1]) {
            setDone(true);
          } else {
            setAnnouncedStepIndex(idx + 1);
          }
        }, STEP_DELAY_MS * (i + 1));
        registerTimer(id);
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    // Belt-and-suspenders timeout: aborts the underlying request AND
    // guarantees this promise chain unblocks even if the network layer
    // never settles the fetch, so the catch block below is guaranteed to
    // eventually run instead of hanging indefinitely (#1108). Declared at
    // effect scope (not inside generate()) so the cleanup below can cancel
    // both if the component unmounts before the request settles.
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new DOMException("Generation request timed out", "TimeoutError"));
      }, GENERATE_TIMEOUT_MS);
    });

    // Timer ids scheduled by completeRemainingSteps (the staggered
    // step-completion timers). Tracked here so the cleanup below can cancel
    // them if the component unmounts mid-sequence — otherwise they'd fire
    // later against a stale closure (#1074).
    const stepTimerIds: ReturnType<typeof setTimeout>[] = [];
    const registerStepTimer = (id: ReturnType<typeof setTimeout>) => {
      stepTimerIds.push(id);
    };

    async function generate() {
      try {
        const res = await Promise.race([
          fetch("/api/generate", {
            method: "POST",
            credentials: "include",
            signal: controller.signal,
          }),
          timeoutPromise,
        ]);
        clearTimeout(timeoutId);

        if (cancelled) return;

        if (!res.ok) {
          const kind: ErrorKind =
            res.status === 429 ? "rateLimited" : res.status === 401 ? "session" : "generic";
          setErrorKind(kind);
          setStepStatuses((prev) =>
            prev.map((s) => (s === 'active' ? 'error' : s)),
          );
          return;
        }

        setStepStatuses(['done', 'active', 'pending', 'pending']);
        setAnnouncedStepIndex(1);
        completeRemainingSteps(registerStepTimer);
      } catch {
        clearTimeout(timeoutId);
        if (cancelled) return;
        setErrorKind("generic");
        setStepStatuses((prev) =>
          prev.map((s) => (s === 'active' ? 'error' : s)),
        );
      }
    }

    generate();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
      stepTimerIds.forEach(clearTimeout);
    };
  }, [completeRemainingSteps]);

  // Reassure the user the wait is normal progress, not a freeze, once the
  // request has been in flight for a while (#1108).
  useEffect(() => {
    const timer = setTimeout(() => setShowSlowNotice(true), SLOW_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Redirect after all steps complete
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => {
      router.push(`/u/${handle}`);
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [done, handle, router]);

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md">
        {/* Terminal header */}
        <div className="mb-8 animate-fade-in-up motion-reduce:animate-none">
          <p className="font-heading text-xs tracking-widest uppercase text-text-secondary">
            <span className="text-terminal-dim">$</span>{" "}
            chapa generate
          </p>
          <h1 className="mt-2 font-heading text-lg font-bold tracking-tight text-text-primary">
            {t('generation.heading') as string}{" "}
            <span className="text-amber">@{handle}</span>
          </h1>
        </div>

        {/* Live status line for screen readers -- a single visually-hidden
            node updated exactly once per step transition (see
            `announcedStepIndex`), instead of wrapping the whole visible step
            list (which re-announces all four rows on every transition,
            #1114). */}
        <div role="status" aria-live="polite" className="sr-only">
          {stepLabels[announcedStepIndex] ?? ''}
        </div>

        {/* Progress steps (visual only -- hidden from the accessibility tree
            so it doesn't double-announce alongside the live status line
            above). */}
        <div aria-hidden="true" className="space-y-3">
          {stepLabels.map((label, i) => {
            const status = stepStatuses[i] ?? 'pending';
            return (
              <div
                key={label}
                data-step={i}
                data-status={status}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 font-heading text-sm transition-all duration-300 ${
                  status === "done"
                    ? "border-terminal-green/20 bg-terminal-green/[0.06]"
                    : status === "active"
                      ? "border-amber/20 bg-amber/[0.06]"
                      : status === "error"
                        ? "border-terminal-red/20 bg-terminal-red/[0.06]"
                        : "border-stroke bg-card/50"
                }`}
                style={{
                  animationDelay: `${i * 100}ms`,
                }}
              >
                {/* Status icon */}
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                  {status === "done" && (
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
                  {status === "active" && (
                    <span className="h-3 w-3 animate-pulse motion-reduce:animate-none rounded-full bg-amber" />
                  )}
                  {status === "error" && (
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
                  {status === "pending" && (
                    <span className="h-2 w-2 rounded-full bg-terminal-dim/40" />
                  )}
                </span>

                {/* Step label */}
                <span
                  className={
                    status === "done"
                      ? "text-terminal-green"
                      : status === "active"
                        ? "text-amber"
                        : status === "error"
                          ? "text-terminal-red"
                          : "text-terminal-dim"
                  }
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Reassurance notice — deliberately outside the role="status" live
            region above so it doesn't cause a re-announcement; it appears
            once and its own content never changes on a tick. */}
        {showSlowNotice && !errorKind && !done && (
          <p className="mt-6 animate-terminal-fade-in motion-reduce:animate-none font-heading text-xs text-text-secondary">
            {t('generation.stillWorking') as string}
          </p>
        )}

        {/* Error message */}
        {errorKind && (
          <div role="alert" className="mt-6 animate-terminal-fade-in motion-reduce:animate-none rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-4">
            <p className="font-heading text-sm text-terminal-red">
              {errorConfig[errorKind].message}
            </p>
            <a
              href={errorConfig[errorKind].href}
              className="mt-2 inline-block font-heading text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
            >
              {errorConfig[errorKind].linkText}
            </a>
          </div>
        )}

        {/* Redirect notice */}
        {done && (
          <p className="mt-6 animate-terminal-fade-in motion-reduce:animate-none font-heading text-xs text-text-secondary">
            {t('generation.redirect') as string}
          </p>
        )}
      </div>
    </main>
  );
}

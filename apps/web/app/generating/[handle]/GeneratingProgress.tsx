"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { markCacheWarmed } from "@/hooks/useOwnerCacheWarm";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

type StepStatus = "pending" | "active" | "done" | "error";
type ErrorKind = "rateLimited" | "session" | "staleSource" | "generic";

// #1335 phase 4 — best-effort progress polling. Bounded and self-contained:
// it never gates the fixed step animation or the redirect below (both of
// which fire on their own schedule regardless), it only enriches step 1's
// label with a real percent when the backend has one. Any failure (network,
// a non-JSON response, an unexpected shape) stops polling silently — this is
// decoration, not a dependency the rest of the flow can be blocked on.
const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_POLL_MAX_ATTEMPTS = 15;

/** Display names for the platforms a user can connect; the API answers with
 * the lowercase provider ids the rest of the codebase uses. */
const PLATFORM_NAMES: Record<string, string> = { bitbucket: "Bitbucket", codeberg: "Codeberg", gitlab: "GitLab" };

const STEP_DELAY_MS = 300;
const REDIRECT_DELAY_MS = 800;
// Generous ceiling: a false timeout (user sees "failed" on a slow-but-working
// request) is worse than a longer worst-case wait. Cold-cache generations
// with large contribution histories are routinely multi-second. (#1108)
// #1283 — /api/generate now makes up to two sequential GitHub attempts
// (session token, then server token), each bounded by getStats' 30s inflight
// cap, so the ceiling sits above the realistic two-attempt worst case (a 15s
// GraphQL timeout followed by a full second fetch) rather than inside it.
const GENERATE_TIMEOUT_MS = 60_000;
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
  const [staleSources, setStaleSources] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [showSlowNotice, setShowSlowNotice] = useState(false);
  // #1335 phase 4 — set once generate succeeds; starts the best-effort
  // status-percent poll below. `collectingPercent` stays null until a real
  // "collecting" status with a percent has been observed.
  const [pollingActive, setPollingActive] = useState(false);
  const [collectingPercent, setCollectingPercent] = useState<number | null>(null);

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
    staleSource: {
      message: interpolate(t('generation.errorStaleSource') as string, {
        platforms: staleSources.map((source) => PLATFORM_NAMES[source] ?? source).join(", "),
      }),
      href: "/settings",
      linkText: t('generation.reconnect') as string,
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
          // 409 carries the connections that blocked the fetch; a malformed or
          // missing body degrades to the generic message rather than throwing.
          const sources = res.status === 409
            ? await res.json().then(
                (body: unknown) => {
                  const value = (body as { staleSources?: unknown } | null)?.staleSources;
                  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
                },
                () => [],
              )
            : [];
          if (cancelled) return;
          setStaleSources(sources);
          const kind: ErrorKind =
            res.status === 429 ? "rateLimited"
              : res.status === 401 ? "session"
                : sources.length > 0 ? "staleSource"
                  : "generic";
          setErrorKind(kind);
          setStepStatuses((prev) =>
            prev.map((s) => (s === 'active' ? 'error' : s)),
          );
          return;
        }

        // LE-5-2 — the share page this redirects to warms the owner's cache
        // with the same session-token fetch that just succeeded here. Record
        // it as done so that visit does not spend a refresh on a repeat.
        // #1353 — unless the server says both live fetches failed and only
        // the durable queue was started; then the share page still warms.
        const body: unknown = await res.json?.().catch(() => null);
        if (cancelled) return;
        if ((body as { statsWarmed?: unknown } | null)?.statsWarmed !== false) {
          markCacheWarmed(handle);
        }
        setStepStatuses(['done', 'active', 'pending', 'pending']);
        setAnnouncedStepIndex(1);
        completeRemainingSteps(registerStepTimer);
        setPollingActive(true);
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
  }, [completeRemainingSteps, handle]);

  // #1335 phase 4 — poll the owner's real scoring status once generate has
  // succeeded, and show a real percent on step 1 when the backend reports
  // one. Deliberately independent of the fixed step animation and redirect
  // above: this never gates them, it only enriches what step 1 says while
  // they run. Stops (and never schedules another poll) the moment the
  // status is no longer "collecting", or after a bounded number of
  // attempts, or on any fetch/parse failure — never on an infinite loop.
  useEffect(() => {
    if (!pollingActive) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch("/api/scoring/status");
        if (cancelled || !res.ok) return;
        const body = (await res.json()) as { scoringStatus?: { kind?: string; percent?: number } } | null;
        if (cancelled) return;
        const status = body?.scoringStatus;
        if (status?.kind !== "collecting" || typeof status.percent !== "number") return;
        setCollectingPercent(status.percent);
      } catch {
        return;
      }
      if (!cancelled && attempts < STATUS_POLL_MAX_ATTEMPTS) {
        timerId = setTimeout(poll, STATUS_POLL_INTERVAL_MS);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [pollingActive]);

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
            <span className="text-amber-text">@{handle}</span>
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
                className={`flex items-center gap-3 rounded-[3px] border px-4 py-3 font-heading text-sm transition-all duration-300 ${
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
                        ? "text-amber-text"
                        : status === "error"
                          ? "text-terminal-red"
                          : "text-terminal-dim"
                  }
                >
                  {label}
                  {/* #1335 phase 4 — a real percent from /api/scoring/status,
                      shown only for step 1 while its status is "collecting".
                      Purely visual (this whole list is aria-hidden); the
                      live-region announcement above stays the plain label. */}
                  {i === 1 && collectingPercent !== null && ` — ${collectingPercent}%`}
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
          <div role="alert" className="mt-6 animate-terminal-fade-in motion-reduce:animate-none rounded-[3px] border border-terminal-red/20 bg-terminal-red/[0.06] p-4">
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

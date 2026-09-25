"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import type { ScoringStatus, ProviderStatus, ProviderStatusReason } from "@/lib/collection/scoring-status";
import type { CollectionJobState } from "@/lib/db/collection-queue";
import type { SourceProvider } from "@/lib/platform/evidence-diagnostics";

/** #1332/#1335 — reuses the same dictionary keys Settings' connection cards
 * and the share page's reconnect notice use, so every owner-facing reconnect
 * CTA reads identically regardless of which surface shows it. */
const RECONNECT_KEYS: Partial<Record<SourceProvider, string>> = {
  bitbucket: "userMenu.reconnectBitbucket",
  codeberg: "userMenu.reconnectCodeberg",
  gitlab: "userMenu.reconnectGitlab",
};

const STATE_KEYS: Record<CollectionJobState, string> = {
  queued: "scoring.status.stateQueued",
  running: "scoring.status.stateRunning",
  waiting_rate_limit: "scoring.status.stateWaitingRateLimit",
  retrying: "scoring.status.stateRetrying",
  complete: "scoring.status.stateComplete",
  failed: "scoring.status.stateFailed",
};

const REASON_KEYS: Record<ProviderStatusReason, string> = {
  reconnect: "scoring.status.reasonReconnect",
  rate_limited: "scoring.status.reasonRateLimited",
  temporary: "scoring.status.reasonTemporary",
  failed: "scoring.status.reasonFailed",
};

/**
 * Resume times read in the viewer's own zone: "10:42 UTC" read as local time
 * looked late to a viewer in UTC+2. The server has no viewer zone, so server
 * HTML and the hydration pass use UTC, and the client re-renders in local time.
 */
function formatResumeTime(iso: string, locale: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (locale) return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(date);
  return `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")} UTC`;
}

const noopSubscribe = () => () => {};

function providerRowState(t: (key: string) => string, source: ProviderStatus, locale: string | null): string {
  const key = STATE_KEYS[source.state];
  if (source.state === "waiting_rate_limit" && source.resumesAt) {
    return interpolate(t(key), { time: formatResumeTime(source.resumesAt, locale) });
  }
  if (source.state === "retrying" && source.resumesAt) {
    return interpolate(t(key), { time: formatResumeTime(source.resumesAt, locale), attempt: String(source.attempt ?? 1) });
  }
  return t(key);
}

interface ScoringStatusPanelProps {
  /**
   * Server-resolved status, when the caller already has one (the share
   * page's owner section passes the exact status it used to decide which
   * badge state to draw, avoiding a second round trip). Omit entirely to
   * have this component fetch `GET /api/scoring/status` itself (`/settings`).
   */
  initialStatus?: ScoringStatus | null;
}

/**
 * Per-provider scoring status: state, resume time, reason and an action
 * (Reconnect or Retry). Shared by `/settings` and the share page's owner
 * section (#1335 phase 4) — one panel, not two copies of this markup. The
 * aggregate percent (or "discovering" while any job's operation count is
 * still growing, #1342) is shown once above the list, not per source row.
 */
export function ScoringStatusPanel({ initialStatus }: ScoringStatusPanelProps) {
  const { t, locale } = useTranslation();
  const timeLocale = useSyncExternalStore(noopSubscribe, () => locale, () => null);
  const [status, setStatus] = useState<ScoringStatus | null | undefined>(initialStatus);
  const [loading, setLoading] = useState(initialStatus === undefined);
  const [loadError, setLoadError] = useState(false);
  const [retryingProvider, setRetryingProvider] = useState<string | null>(null);
  const [retryErrorProvider, setRetryErrorProvider] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/scoring/status");
      if (!res.ok) throw new Error(`scoring status ${res.status}`);
      const body = (await res.json()) as { scoringStatus: ScoringStatus };
      setStatus(body.scoringStatus);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialStatus !== undefined) return;
    // Mount-time fetch: `fetchStatus` calls `setLoading(true)` synchronously
    // before its first await, which is exactly the intended kickoff for this
    // effect (fetch on mount when the caller has no server-resolved status)
    // rather than the "derived state" case the rule guards against.
    void fetchStatus(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [initialStatus, fetchStatus]);

  async function handleRetry(provider: string) {
    setRetryingProvider(provider);
    setRetryErrorProvider(null);
    try {
      const res = await fetch("/api/scoring/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", provider }),
      });
      if (!res.ok) throw new Error(`retry ${res.status}`);
      await fetchStatus();
    } catch {
      setRetryErrorProvider(provider);
    } finally {
      setRetryingProvider(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">{t("scoring.status.panelLoading") as string}</p>;
  }
  if (loadError || status === undefined) {
    return <p className="text-sm text-terminal-red">{t("scoring.status.panelError") as string}</p>;
  }
  if (status === null || status.kind === "unregistered") {
    return <p className="text-sm text-text-secondary">{t("scoring.status.panelUnregistered") as string}</p>;
  }

  return (
    <section aria-labelledby="scoring-status-heading" className="space-y-4">
      <h2 id="scoring-status-heading" className="font-heading text-lg font-semibold tracking-tight text-text-primary">
        {t("scoring.status.panelTitle") as string}
      </h2>

      {status.kind === "ready" ? (
        <p className="text-sm text-text-secondary" data-testid="scoring-status-ready">
          {status.updating ? (t("scoring.status.panelUpdating") as string) : (t("scoring.status.panelReady") as string)}
        </p>
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            {status.kind === "collecting"
              ? status.percent === null
                ? (t("scoring.status.panelDiscovering") as string)
                : interpolate(t("scoring.status.panelCollecting") as string, { percent: String(status.percent) })
              : (t("scoring.status.panelActionNeeded") as string)}
          </p>
          <ul className="space-y-2">
            {status.sources.map((source) => {
              const reconnectKey = source.reason === "reconnect" ? RECONNECT_KEYS[source.provider] : undefined;
              const canRetry = source.state === "failed" && source.reason !== "reconnect";
              return (
                <li
                  key={source.provider}
                  data-testid={`scoring-status-source-${source.provider}`}
                  className="flex flex-wrap items-center gap-3 rounded-[3px] border border-stroke bg-card px-4 py-3"
                >
                  <span className="font-heading text-xs uppercase text-terminal-dim">{source.provider}</span>
                  <span className="text-sm text-text-primary">{providerRowState((key) => t(key) as string, source, timeLocale)}</span>
                  {source.reason && (
                    <span className="text-xs text-text-secondary">{t(REASON_KEYS[source.reason]) as string}</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    {reconnectKey && (
                      <a
                        href={`/api/auth/${source.provider}/connect?returnTo=${encodeURIComponent("/settings")}`}
                        className="inline-flex min-h-[44px] items-center rounded-[3px] bg-action px-4 py-2 text-sm font-semibold text-action-text hover:bg-action-hover"
                      >
                        {t(reconnectKey) as string}
                      </a>
                    )}
                    {canRetry && (
                      <button
                        type="button"
                        onClick={() => handleRetry(source.provider)}
                        disabled={retryingProvider === source.provider}
                        className="inline-flex min-h-[44px] items-center rounded-[3px] border border-text-primary px-4 py-2 text-sm text-text-primary hover:bg-purple-tint disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {retryingProvider === source.provider ? (t("scoring.status.retrying") as string) : (t("scoring.status.retry") as string)}
                      </button>
                    )}
                  </div>
                  {retryErrorProvider === source.provider && (
                    <p className="w-full text-xs text-terminal-red">{t("scoring.status.retryError") as string}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

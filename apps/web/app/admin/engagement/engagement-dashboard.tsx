"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EngagementFlag {
  key: string;
  enabled: boolean;
  description: string;
}

// Human-readable labels
const FLAG_LABELS: Record<string, string> = {
  score_notifications: "Score Notifications",
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  score_notifications:
    "Email developers when their Impact score increases significantly, their tier changes, or their archetype evolves.",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EngagementDashboard() {
  const [flags, setFlags] = useState<EngagementFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/engagement-flags");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setFlags(json.flags ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = useCallback(
    async (key: string, enabled: boolean) => {
      setPending(key);
      try {
        const res = await fetch("/api/admin/feature-flags", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, enabled }),
        });
        if (res.ok) {
          await fetchFlags();
        }
      } finally {
        setPending(null);
      }
    },
    [fetchFlags],
  );

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stroke border-t-amber" />
        <p className="font-heading text-sm text-text-secondary">
          <span className="text-amber">$</span> loading engagement data...
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="rounded-xl border border-terminal-red/20 bg-terminal-red/5 p-6">
          <p className="font-heading text-sm text-terminal-red">
            <span className="text-terminal-red/50">ERR</span> {error}
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchFlags();
            }}
            className="mt-4 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white hover:bg-amber-light"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading text-lg tracking-tight text-text-primary">
          <span className="text-amber">$</span> engagement
          <span className="text-text-secondary">/</span>notifications
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Control email notifications sent to developers when their badge data
          changes.
        </p>
      </div>

      {/* Toggles table */}
      <div className="rounded-xl border border-stroke bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke">
              <th className="px-4 py-3 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider">
                Feature
              </th>
              <th className="px-4 py-3 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider hidden sm:table-cell">
                Description
              </th>
              <th className="px-4 py-3 text-right font-heading text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr
                key={flag.key}
                className="border-b border-stroke last:border-0"
              >
                <td className="px-4 py-3 font-heading text-sm text-text-primary">
                  {FLAG_LABELS[flag.key] ?? flag.key}
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs hidden sm:table-cell max-w-sm">
                  {FLAG_DESCRIPTIONS[flag.key] ?? flag.description}
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleSwitch
                    enabled={flag.enabled}
                    loading={pending === flag.key}
                    onToggle={(v) => handleToggle(flag.key, v)}
                    label={`Toggle ${FLAG_LABELS[flag.key] ?? flag.key}`}
                  />
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-sm text-text-secondary"
                >
                  No engagement flags configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch (same pattern as agent-toggles-table.tsx)
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  loading,
  onToggle,
  label,
}: {
  enabled: boolean;
  loading: boolean;
  onToggle: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={loading}
      onClick={() => onToggle(!enabled)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? "bg-amber" : "bg-stroke"
      } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

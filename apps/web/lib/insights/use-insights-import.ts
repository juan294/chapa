"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";

/**
 * AI-insights import, shared by the user menu and `/settings` (#1223).
 *
 * Extracted from `UserMenu` rather than reimplemented: the cooldown, the
 * hydration-safe state seeding and the three-stage toast sequence are exactly
 * the parts that are easy to get subtly wrong twice.
 */

export const INSIGHTS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_INSIGHTS_FILE_BYTES = 10 * 1024 * 1024;
const RELOAD_DELAY_MS = 2500;

export interface InsightsToast {
  message: string;
  detail?: string;
  type: "loading" | "success" | "error" | "info";
}

export interface InsightsImport {
  toast: InsightsToast | null;
  dismissToast: () => void;
  cooldownActive: boolean;
  /** Human-readable "next allowed" hint, or undefined when not cooling down. */
  cooldownTooltip: string | undefined;
  importFile: (file: File) => Promise<void>;
}

// Maps the raw `CraftTier` enum value returned by /api/insights and
// /api/recalculate (see packages/shared's `CraftTier`) to its dictionary key.
// Kept separate from any single tier's translated string so an unrecognized
// value (e.g. a tier added server-side before the dictionary catches up)
// falls back to the raw string instead of resolving to `undefined` or a bare
// key path (#1170 / FE-M4).
const CRAFT_TIER_DICTIONARY_KEYS: Record<string, string> = {
  Novice: "userMenu.craftTierNovice",
  Practitioner: "userMenu.craftTierPractitioner",
  Expert: "userMenu.craftTierExpert",
  Master: "userMenu.craftTierMaster",
};

/**
 * Resolve a raw craft tier value to its translated display name, falling back
 * to the raw value when the tier is not in the dictionary.
 */
function resolveCraftTierLabel(
  t: (key: string) => unknown,
  tier: string | undefined | null,
): string {
  if (!tier) return "";
  const dictKey = CRAFT_TIER_DICTIONARY_KEYS[tier];
  if (!dictKey) return tier;
  const label = t(dictKey);
  return typeof label === "string" ? label : tier;
}

export function useInsightsImport(login: string): InsightsImport {
  const { t } = useTranslation();
  const storageKey = `chapa_insights_last_submitted_${login}`;
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<InsightsToast | null>(null);

  // Cooldown state is seeded with deterministic defaults (0 / null) so the
  // initial server and client renders match; the real values are populated in
  // a mount-time effect to avoid hydration mismatches and the use of
  // Date.now()/localStorage inside a useState initializer (#892).
  const [now, setNow] = useState(0);
  const [lastSubmitted, setLastSubmitted] = useState<Date | null>(null);

  useEffect(() => {
    // Read the cooldown timestamp and capture "now" AFTER mount so the initial
    // server/client render stays deterministic (#892). Setting state here is
    // the intended client-only hydration of browser-derived values; the rule
    // below is a false positive for that case.
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    if (typeof window === "undefined" || !window.localStorage) return;
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const date = new Date(stored);
      if (!Number.isNaN(date.getTime())) setLastSubmitted(date);
    } catch {
      // Ignore malformed stored values — cooldown stays inactive.
    }
  }, [storageKey]);

  useEffect(
    () => () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    },
    [],
  );

  const cooldownActive =
    lastSubmitted !== null &&
    now - lastSubmitted.getTime() < INSIGHTS_COOLDOWN_MS;

  const cooldownTooltip =
    cooldownActive && lastSubmitted
      ? `${t("userMenu.insightsCooldownPrefix") as string}${new Date(
          lastSubmitted.getTime() + INSIGHTS_COOLDOWN_MS,
        ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : undefined;

  const importFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_INSIGHTS_FILE_BYTES) {
        setToast({
          message: t("userMenu.insightsFileTooLarge") as string,
          detail: t("userMenu.insightsFileTooLargeDetail") as string,
          type: "error",
        });
        return;
      }

      setToast({
        message: t("userMenu.insightsProcessing") as string,
        type: "loading",
      });

      try {
        const html = await file.text();
        const { parseInsightsHtml } = await import("@/lib/insights/parser");
        const data = parseInsightsHtml(html);

        const uploadRes = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!uploadRes.ok) throw new Error("Upload failed");

        setToast({
          message: t("userMenu.insightsRecalculating") as string,
          type: "loading",
        });

        const [uploadData, recalcRes] = await Promise.all([
          uploadRes.json(),
          fetch("/api/recalculate", { method: "POST" }),
        ]);

        const submittedAt = new Date();
        localStorage.setItem(storageKey, submittedAt.toISOString());
        setLastSubmitted(submittedAt);
        setNow(submittedAt.getTime());

        if (recalcRes.ok) {
          const recalcData = await recalcRes.json();
          const craftScore =
            uploadData.craftScore?.craftScore ?? recalcData.craftScore;
          const craftTier = uploadData.craftScore?.tier ?? recalcData.craftTier;
          setToast({
            message: interpolate(t("userMenu.insightsCraftResult") as string, {
              craftScore: String(craftScore),
              craftTier: resolveCraftTierLabel(t, craftTier),
            }),
            detail: interpolate(t("userMenu.insightsScoreUpdated") as string, {
              score: String(recalcData.adjustedComposite),
            }),
            type: "success",
          });
        } else {
          const craftScore = uploadData.craftScore?.craftScore;
          const craftTier = uploadData.craftScore?.tier;
          setToast({
            message: craftScore
              ? interpolate(t("userMenu.insightsCraftResult") as string, {
                  craftScore: String(craftScore),
                  craftTier: resolveCraftTierLabel(t, craftTier),
                })
              : (t("userMenu.insightsImported") as string),
            detail: t("userMenu.insightsImportedDetail") as string,
            type: "success",
          });
        }

        if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = setTimeout(() => {
          if (typeof window !== "undefined") window.location.reload();
        }, RELOAD_DELAY_MS);
      } catch {
        setToast({
          message: t("userMenu.insightsImportFailed") as string,
          detail: t("userMenu.insightsImportFailedDetail") as string,
          type: "error",
        });
      }
    },
    [storageKey, t],
  );

  return {
    toast,
    dismissToast: useCallback(() => setToast(null), []),
    cooldownActive,
    cooldownTooltip,
    importFile,
  };
}

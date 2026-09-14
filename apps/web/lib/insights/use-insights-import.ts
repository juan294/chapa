"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import type { ReportCraftImport } from "./report-craft-import";

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
  id: number;
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
  processing: boolean;
  pendingConfirmation: "publication" | "replacement" | "retry" | null;
  confirmImport: () => Promise<void>;
  cancelImport: () => void;
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

export function useInsightsImport(login: string, scoringPolicy: "v6" | "v7.2" = "v6"): InsightsImport {
  const { t } = useTranslation();
  const storageKey = `chapa_insights_last_submitted_${login}`;
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<InsightsToast | null>(null);
  const [processing, setProcessing] = useState(false);
  type Draft = { report: ReportCraftImport; publicationAcknowledged?: boolean; supersedesReportId?: string };
  const [pending, setPending] = useState<(Draft & { kind: "publication" | "replacement" | "retry" }) | null>(null);
  const context = `${login}:${scoringPolicy}`;
  const activeContext = useRef(context);
  const busy = useRef(false);
  useEffect(() => {
    activeContext.current = context;
    busy.current = false;
    // A draft and its acknowledgments belong only to the account/policy that created it.
    setPending(null); // eslint-disable-line react-hooks/set-state-in-effect
    setToast(null);
    setProcessing(false);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    return () => { activeContext.current = ""; };
  }, [context]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((notification: Omit<InsightsToast, "id">) => {
    setToast({ ...notification, id: ++toastIdRef.current });
  }, []);

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
    if (!stored) { setLastSubmitted(null); return; }
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
    scoringPolicy === "v6" && lastSubmitted !== null &&
    now - lastSubmitted.getTime() < INSIGHTS_COOLDOWN_MS;

  const cooldownTooltip =
    cooldownActive && lastSubmitted
      ? `${t("userMenu.insightsCooldownPrefix") as string}${new Date(
          lastSubmitted.getTime() + INSIGHTS_COOLDOWN_MS,
        ).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : undefined;

  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  }, []);

  const uploadObserved = useCallback(async (draft: Draft) => {
    setProcessing(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaVersion: "v7.2", ...draft }),
      });
      const result = await response.json();
      if (activeContext.current !== context) return;
      if (response.status === 409 && result.error === "publication_acknowledgment_required") {
        setPending({ ...draft, kind: "publication" });
        showToast({ message: t("userMenu.insightsPublicationTitle") as string, type: "info" });
        return;
      }
      if (response.status === 409 && result.error === "same_period_requires_explicit_correction" && typeof result.supersedesReportId === "string") {
        setPending({ ...draft, supersedesReportId: result.supersedesReportId, kind: "replacement" });
        showToast({ message: t("userMenu.insightsReplacementTitle") as string, type: "info" });
        return;
      }
      setPending({ ...draft, kind: "retry" });
      if (!response.ok || result.persisted !== true) throw new Error("Report publication unavailable");
      if (!["published", "unchanged"].includes(result.publication) || result.refreshed !== true) {
        showToast({ message: t("userMenu.insightsPublicationPending") as string, detail: t("userMenu.insightsRetryDetail") as string, type: "error" });
        return;
      }
      setPending(null);
      const point = result.craft?.status === "scored" ? result.craft.report?.result?.point : null;
      if (typeof point?.displayLabel === "string" && ["insufficient", "older", "outside_window"].includes(result.reportSelection)) {
        showToast({ message: t("userMenu.insightsCraftRetained") as string, detail: t("userMenu.insightsReportCraftDetail") as string, type: "info" });
      } else if (typeof point?.displayLabel === "string") {
        showToast({ message: interpolate(t("userMenu.insightsReportCraftResult") as string, { score: point.displayLabel }), detail: t("userMenu.insightsReportCraftDetail") as string, type: "success" });
      } else {
        showToast({ message: t(result.craft?.status === "insufficient_report_data" ? "userMenu.insightsReportInsufficient" : "userMenu.insightsNoCurrentCraft") as string, detail: t("userMenu.insightsReportCraftDetail") as string, type: "info" });
      }
      scheduleReload();
    } catch {
      if (activeContext.current !== context) return;
      setPending({ ...draft, kind: "retry" });
      showToast({ message: t("userMenu.insightsImportFailed") as string, detail: t("userMenu.insightsImportFailedDetail") as string, type: "error" });
    } finally { if (activeContext.current === context) setProcessing(false); }
  }, [showToast, t, scheduleReload, context]);

  const confirmImport = useCallback(async () => {
    if (!pending || busy.current || scoringPolicy !== "v7.2" || activeContext.current !== context) return;
    busy.current = true;
    const { kind, ...draft } = pending;
    try {
      await uploadObserved({ ...draft, ...(kind === "publication" ? { publicationAcknowledged: true } : {}) });
    } finally { if (activeContext.current === context) busy.current = false; }
  }, [pending, scoringPolicy, context, uploadObserved]);
  const cancelImport = useCallback(() => { setPending(null); setToast(null); }, []);

  const importFile = useCallback(
    async (file: File) => {
      if (busy.current || activeContext.current !== context) return;
      if (file.size > MAX_INSIGHTS_FILE_BYTES) {
        showToast({
          message: t("userMenu.insightsFileTooLarge") as string,
          detail: t("userMenu.insightsFileTooLargeDetail") as string,
          type: "error",
        });
        return;
      }

      busy.current = true;
      setProcessing(true);
      showToast({
        message: t("userMenu.insightsProcessing") as string,
        type: "loading",
      });

      try {
        const html = await file.text();
        if (activeContext.current !== context) return;
        if (scoringPolicy === "v7.2") {
          const { parseReportCraftHtml } = await import("./report-craft-import");
          if (activeContext.current !== context) return;
          setPending(null);
          await uploadObserved({ report: parseReportCraftHtml(html) });
          return;
        }
        const { parseInsightsHtml } = await import("@/lib/insights/parser");
        if (activeContext.current !== context) return;
        const data = parseInsightsHtml(html);

        const uploadRes = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Chapa-Scoring-Policy": "v6" },
          body: JSON.stringify(data),
        });
        if (activeContext.current !== context) return;
        if (!uploadRes.ok) throw new Error("Upload failed");

        showToast({
          message: t("userMenu.insightsRecalculating") as string,
          type: "loading",
        });

        const uploadData = await uploadRes.json();
        if (activeContext.current !== context) return;
        if (uploadData.persisted === false) throw new Error("Insights were not saved");
        const recalcRes = await fetch("/api/recalculate", { method: "POST" });

        if (activeContext.current !== context) return;
        const submittedAt = new Date();
        localStorage.setItem(storageKey, submittedAt.toISOString());
        setLastSubmitted(submittedAt);
        setNow(submittedAt.getTime());

        if (recalcRes.ok) {
          const recalcData = await recalcRes.json();
          if (activeContext.current !== context) return;
          const craftScore =
            uploadData.craftScore?.craftScore ?? recalcData.craftScore;
          const craftTier = uploadData.craftScore?.tier ?? recalcData.craftTier;
          showToast({
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
          showToast({
            message: typeof craftScore === "number"
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
        if (activeContext.current !== context) return;
        showToast({
          message: t("userMenu.insightsImportFailed") as string,
          detail: t("userMenu.insightsImportFailedDetail") as string,
          type: "error",
        });
      } finally {
        if (activeContext.current === context) {
          busy.current = false;
          setProcessing(false);
        }
      }
    },
    [storageKey, t, showToast, scoringPolicy, uploadObserved, context],
  );

  return {
    toast,
    dismissToast: useCallback(() => setToast(null), []),
    cooldownActive,
    cooldownTooltip,
    importFile,
    processing,
    pendingConfirmation: pending?.kind ?? null,
    confirmImport,
    cancelImport,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/interpolate";
import type { ReportCraftImport } from "./report-craft-import";

/**
 * AI-insights import for `/settings` (#1223).
 *
 * #1335 — v7.2 is the one scoring policy: the legacy v6 upload path
 * (`/api/insights` + `/api/recalculate`, with its 14-day cooldown) is gone.
 * Every import now publishes a report-derived Craft observation through
 * `uploadObserved`, with no cooldown — a report can be re-submitted any time
 * (the server enforces same-period-requires-explicit-correction instead).
 *
 * The hydration-safe state seeding and the toast-identity sequencing are
 * exactly the parts that are easy to get subtly wrong twice.
 */

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
  importFile: (file: File) => Promise<void>;
  processing: boolean;
  pendingConfirmation: "replacement" | "retry" | null;
  confirmImport: () => Promise<void>;
  cancelImport: () => void;
}

export function useInsightsImport(login: string): InsightsImport {
  const { t } = useTranslation();
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<InsightsToast | null>(null);
  const [processing, setProcessing] = useState(false);
  type Draft = { report: ReportCraftImport; supersedesReportId?: string };
  const [pending, setPending] = useState<(Draft & { kind: "replacement" | "retry" }) | null>(null);
  const activeContext = useRef(login);
  const busy = useRef(false);
  useEffect(() => {
    activeContext.current = login;
    busy.current = false;
    // A draft and its acknowledgments belong only to the account that created it.
    setPending(null); // eslint-disable-line react-hooks/set-state-in-effect
    setToast(null);
    setProcessing(false);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    return () => { activeContext.current = ""; };
  }, [login]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((notification: Omit<InsightsToast, "id">) => {
    setToast({ ...notification, id: ++toastIdRef.current });
  }, []);

  useEffect(
    () => () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    },
    [],
  );

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
      if (activeContext.current !== login) return;
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
      if (activeContext.current !== login) return;
      setPending({ ...draft, kind: "retry" });
      showToast({ message: t("userMenu.insightsImportFailed") as string, detail: t("userMenu.insightsImportFailedDetail") as string, type: "error" });
    } finally { if (activeContext.current === login) setProcessing(false); }
  }, [showToast, t, scheduleReload, login]);

  const confirmImport = useCallback(async () => {
    if (!pending || busy.current || activeContext.current !== login) return;
    busy.current = true;
    const { kind: _kind, ...draft } = pending;
    try {
      await uploadObserved(draft);
    } finally { if (activeContext.current === login) busy.current = false; }
  }, [pending, login, uploadObserved]);
  const cancelImport = useCallback(() => { setPending(null); setToast(null); }, []);

  const importFile = useCallback(
    async (file: File) => {
      if (busy.current || activeContext.current !== login) return;
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
        if (activeContext.current !== login) return;
        const { parseReportCraftHtml } = await import("./report-craft-import");
        if (activeContext.current !== login) return;
        setPending(null);
        await uploadObserved({ report: parseReportCraftHtml(html) });
      } catch {
        if (activeContext.current !== login) return;
        showToast({
          message: t("userMenu.insightsImportFailed") as string,
          detail: t("userMenu.insightsImportFailedDetail") as string,
          type: "error",
        });
      } finally {
        if (activeContext.current === login) {
          busy.current = false;
          setProcessing(false);
        }
      }
    },
    [t, showToast, uploadObserved, login],
  );

  return {
    toast,
    dismissToast: useCallback(() => setToast(null), []),
    importFile,
    processing,
    pendingConfirmation: pending?.kind ?? null,
    confirmImport,
    cancelImport,
  };
}

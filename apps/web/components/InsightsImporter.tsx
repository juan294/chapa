"use client";

import { useRef, useState } from "react";
import type { CraftResult, InsightsUpload } from "@chapa/shared";
import { InsightsPreview } from "./InsightsPreview";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type Status = "idle" | "parsing" | "preview" | "uploading" | "success" | "error";

interface InsightsImporterProps {
  onSuccess?: (craftScore: CraftResult) => void;
  onClose?: () => void;
}

export function InsightsImporter({
  onSuccess,
  onClose,
}: InsightsImporterProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [parsed, setParsed] = useState<InsightsUpload | null>(null);
  const [result, setResult] = useState<CraftResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("File too large (max 10 MB)");
      setStatus("error");
      return;
    }

    setStatus("parsing");
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { parseInsightsHtml } = await import("@/lib/insights/parser");
        const html = reader.result as string;
        const data = parseInsightsHtml(html);
        setParsed(data);
        setStatus("preview");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to parse report",
        );
        setStatus("error");
      }
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file");
      setStatus("error");
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? `Upload failed (${res.status})`;
        setErrorMsg(msg);
        setStatus("error");
        return;
      }

      const body = (await res.json()) as { craftScore: CraftResult };
      setResult(body.craftScore);
      setStatus("success");
      onSuccess?.(body.craftScore);
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  function handleReset() {
    setStatus("idle");
    setParsed(null);
    setResult(null);
    setErrorMsg("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-stroke bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stroke">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-amber"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <h3 className="font-heading text-sm font-medium text-text-primary">
            Import AI Insights
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-text-secondary transition-colors hover:text-text-primary"
            aria-label="Close"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Idle — file picker */}
        {status === "idle" && (
          <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-4">
              Upload your Claude Code{" "}
              <span className="font-heading text-text-primary">/insights</span>{" "}
              report to generate your Craft Score.
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Choose .html file
              <input
                ref={fileRef}
                type="file"
                accept=".html"
                onChange={handleFileSelect}
                className="sr-only"
                aria-label="Select Claude Code insights HTML report"
              />
            </label>
          </div>
        )}

        {/* Parsing */}
        {status === "parsing" && (
          <div className="text-center py-6">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            <p className="text-sm text-text-secondary mt-2">
              Parsing report...
            </p>
          </div>
        )}

        {/* Preview */}
        {status === "preview" && parsed && (
          <div>
            <InsightsPreview data={parsed} />
            <div className="flex items-center gap-3 mt-5 pt-4 border-t border-stroke">
              <button
                type="button"
                onClick={handleUpload}
                className="rounded-lg bg-amber px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
              >
                Upload & Score
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Uploading */}
        {status === "uploading" && (
          <div className="text-center py-6">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
            <p className="text-sm text-text-secondary mt-2" aria-busy="true">
              Computing Craft Score...
            </p>
          </div>
        )}

        {/* Success */}
        {status === "success" && result && (
          <div role="status" aria-live="polite">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-terminal-green text-sm font-medium mb-3">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Insights uploaded successfully
              </div>
              <div className="rounded-xl border border-stroke bg-bg p-4">
                <div className="font-heading text-3xl font-extrabold text-text-primary">
                  {result.craftScore}
                </div>
                <div className="text-xs text-text-secondary uppercase tracking-wider mt-1">
                  Craft Score — {result.tier}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {(
                    [
                      ["Proficiency", result.dimensions.proficiency],
                      ["Effectiveness", result.dimensions.effectiveness],
                      ["Sophistication", result.dimensions.sophistication],
                    ] as const
                  ).map(([label, val]) => (
                    <div key={label} className="text-center">
                      <div className="font-heading text-lg font-bold text-text-primary">
                        {val}
                      </div>
                      <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="mt-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                Upload another report
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div role="status" aria-live="polite">
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-terminal-red text-sm font-medium mb-3">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {errorMsg}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

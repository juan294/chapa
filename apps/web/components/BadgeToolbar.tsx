"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trackEvent } from "@/lib/analytics/posthog";
import Link from "next/link";

interface BadgeToolbarProps {
  handle: string;
  isOwner: boolean;
  studioEnabled: boolean;
}

export function BadgeToolbar({
  handle,
  isOwner,
  studioEnabled,
}: BadgeToolbarProps) {
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [shareOpen]);

  async function handleRefresh() {
    setRefreshStatus("loading");
    try {
      const res = await fetch(
        `/api/refresh?handle=${encodeURIComponent(handle)}`,
        { method: "POST" },
      );
      if (res.ok) {
        setRefreshStatus("success");
        setTimeout(() => window.location.reload(), 500);
      } else {
        setRefreshStatus("error");
        setTimeout(() => setRefreshStatus("idle"), 3000);
      }
    } catch {
      setRefreshStatus("error");
      setTimeout(() => setRefreshStatus("idle"), 3000);
    }
  }

  const [copied, setCopied] = useState(false);

  const shareUrl = `https://chapa.thecreativetoken.com/u/${handle}`;
  const tweetText = encodeURIComponent(
    `Check out my developer impact badge on Chapa! ${shareUrl}`,
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent("share_clicked", { platform: "copy_link" });
      setShareOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may be blocked */
    }
  }, [shareUrl]);

  const [downloadStatus, setDownloadStatus] = useState<"idle" | "loading">("idle");

  const handleDownload = useCallback(async () => {
    setDownloadStatus("loading");
    trackEvent("badge_downloaded", { handle });
    try {
      const res = await fetch(`/u/${encodeURIComponent(handle)}/opengraph-image`);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chapa-${handle}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silently fail */
    } finally {
      setDownloadStatus("idle");
    }
  }, [handle]);

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-amber/[0.06] transition-colors";

  return (
    <div className="flex items-center gap-1">
      {/* Refresh (owner only) */}
      {isOwner && (
        <button
          onClick={handleRefresh}
          disabled={refreshStatus === "loading" || refreshStatus === "success"}
          title={
            refreshStatus === "idle"
              ? "Refresh badge data"
              : refreshStatus === "loading"
                ? "Refreshing\u2026"
                : refreshStatus === "success"
                  ? "Refreshed!"
                  : "Failed \u2014 try again"
          }
          aria-label="Refresh badge data"
          className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <svg
            className={`w-3.5 h-3.5 ${refreshStatus === "loading" ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {refreshStatus === "idle" && "Refresh"}
          {refreshStatus === "loading" && "Refreshing\u2026"}
          {refreshStatus === "success" && "Refreshed!"}
          {refreshStatus === "error" && "Failed"}
        </button>
      )}

      {/* Share dropdown */}
      <div className="relative" ref={shareRef}>
        <button
          onClick={() => setShareOpen(!shareOpen)}
          aria-expanded={shareOpen}
          aria-haspopup="true"
          className={btnClass}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>

        {shareOpen && (
          <div
            className="absolute top-full left-0 mt-2 min-w-[140px] rounded-xl border border-stroke bg-card shadow-xl shadow-black/20 p-1.5 z-20 animate-terminal-fade-in"
            role="menu"
          >
            <a
              href={`https://x.com/intent/tweet?text=${tweetText}`}
              onClick={() => {
                trackEvent("share_clicked", { platform: "x" });
                setShareOpen(false);
              }}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
            >
              Post on
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="X"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <button
              onClick={handleCopyLink}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors w-full"
            >
              {copied ? "Copied!" : "Copy link"}
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {copied ? (
                  <path d="M20 6L9 17l-5-5" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Download PNG */}
      <button
        onClick={handleDownload}
        disabled={downloadStatus === "loading"}
        aria-label="Download badge as PNG"
        className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {downloadStatus === "loading" ? "Downloading\u2026" : "Download"}
      </button>

      {/* Customize (owner + studio enabled) */}
      {isOwner && studioEnabled && (
        <Link href="/studio" className={btnClass}>
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l1.912 5.813h6.088l-4.956 3.574 1.912 5.813L12 14.626 7.044 18.2l1.912-5.813L4 8.813h6.088z" />
          </svg>
          Customize
        </Link>
      )}
    </div>
  );
}

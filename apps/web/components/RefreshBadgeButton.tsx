"use client";

import { useState } from "react";

interface RefreshBadgeButtonProps {
  handle: string;
}

export function RefreshBadgeButton({ handle }: RefreshBadgeButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function handleRefresh() {
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/refresh?handle=${encodeURIComponent(handle)}`,
        { method: "POST" },
      );
      if (res.ok) {
        setStatus("success");
        setTimeout(() => window.location.reload(), 500);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={status === "loading" || status === "success"}
      title={
        status === "idle"
          ? "Refresh badge data"
          : status === "loading"
            ? "Refreshing\u2026"
            : status === "success"
              ? "Refreshed!"
              : "Failed \u2014 try again"
      }
      className="absolute top-6 right-6 z-10 rounded-full p-2 border border-stroke bg-card/80 backdrop-blur-sm text-text-secondary hover:text-amber hover:border-amber/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Refresh badge data"
    >
      <svg
        className={`w-4 h-4 ${status === "loading" ? "animate-spin" : ""}`}
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
    </button>
  );
}

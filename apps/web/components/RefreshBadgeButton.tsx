"use client";

import { useState } from "react";
import { KbdHint } from "./KbdHint";

interface RefreshBadgeButtonProps {
  handle: string;
}

export function RefreshBadgeButton({ handle }: RefreshBadgeButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleRefresh() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("success");
        // Reload page to show fresh data
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
      className="inline-flex items-center gap-2 rounded-lg border border-stroke px-4 py-2.5 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      {status === "idle" && "Refresh Badge"}
      {status === "loading" && "Refreshing..."}
      {status === "success" && "Refreshed!"}
      {status === "error" && "Failed — try again"}
      <KbdHint keys={["⇧", "⌘", "R"]} className="ml-1.5" />
    </button>
  );
}

"use client";

import { useState } from "react";

interface Props {
  sessionId: string;
  handle: string;
}

export function AuthorizeClient({ sessionId, handle }: Props) {
  const [state, setState] = useState<"idle" | "approving" | "approved" | "error">("idle");

  async function handleApprove() {
    setState("approving");
    try {
      const res = await fetch("/api/cli/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        setState("approved");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md rounded-xl border border-stroke bg-card p-8">
        <h1 className="font-heading text-xl font-bold text-text-primary mb-2">
          Authorize Chapa CLI
        </h1>

        {state === "approved" ? (
          <div className="space-y-4">
            <p className="text-terminal-green font-heading text-sm">
              Authorized! You can close this tab and return to your terminal.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-text-secondary text-sm leading-relaxed">
              The Chapa CLI is requesting access to your account.
            </p>

            <div className="rounded-lg border border-stroke bg-bg p-4">
              <p className="text-text-secondary text-xs mb-1">Logged in as</p>
              <p className="font-heading text-amber font-bold">{handle}</p>
            </div>

            <p className="text-text-secondary text-xs leading-relaxed">
              This will allow the CLI to upload supplemental stats (EMU contributions) to your badge. It will not access your GitHub repositories or code.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={state === "approving"}
                className="flex-1 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 disabled:opacity-50 transition-all"
              >
                {state === "approving" ? "Authorizing..." : "Authorize CLI"}
              </button>
            </div>

            {state === "error" && (
              <p className="text-terminal-red text-xs">
                Failed to authorize. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface DeviceContext {
  ip: string;
  userAgent: string;
}

interface Props {
  sessionId: string;
  handle: string;
  /**
   * IP/user-agent of the device that initiated this authorization request
   * (SE-H1 interim mitigation, #1174). `null` when unavailable (session
   * predates this change, expired, or Redis is unreachable) — the page
   * degrades gracefully by showing no device details rather than failing.
   */
  deviceContext?: DeviceContext | null;
}

export function AuthorizeClient({ sessionId, handle, deviceContext = null }: Props) {
  const { t } = useTranslation();
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
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md rounded-xl border border-stroke bg-card p-8">
        <h1 className="font-heading text-xl font-bold text-text-primary mb-2">
          {t('cliAuthorize.h1') as string}
        </h1>

        {state === "approved" ? (
          <div className="space-y-4">
            <p className="text-terminal-green font-heading text-sm">
              {t('cliAuthorize.authorized') as string}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-text-secondary text-sm leading-relaxed">
              {t('cliAuthorize.description') as string}
            </p>

            <div className="rounded-lg border border-stroke bg-bg p-4">
              <p className="text-text-secondary text-xs mb-1">{t('cliAuthorize.loggedInAs') as string}</p>
              <p className="font-heading text-amber font-bold">{handle}</p>
            </div>

            <div
              data-testid="cli-device-context"
              className="rounded-lg border border-stroke bg-bg p-4 space-y-2"
            >
              <p className="text-text-secondary text-xs">
                {t('cliAuthorize.deviceContextHeading') as string}
              </p>
              {deviceContext ? (
                <div className="font-heading text-xs text-text-primary space-y-1 break-all">
                  <p>
                    <span className="text-text-secondary">
                      {t('cliAuthorize.deviceContextIpLabel') as string}:{" "}
                    </span>
                    {deviceContext.ip}
                  </p>
                  <p>
                    <span className="text-text-secondary">
                      {t('cliAuthorize.deviceContextUserAgentLabel') as string}:{" "}
                    </span>
                    {deviceContext.userAgent}
                  </p>
                </div>
              ) : (
                <p className="text-text-secondary text-xs">
                  {t('cliAuthorize.deviceContextUnavailable') as string}
                </p>
              )}
              <p className="text-terminal-yellow text-xs leading-relaxed">
                {t('cliAuthorize.deviceContextWarning') as string}
              </p>
            </div>

            <p className="text-text-secondary text-xs leading-relaxed">
              {t('cliAuthorize.bodyExplainer') as string}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={state === "approving"}
                className="flex-1 rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 disabled:opacity-50 transition-all"
              >
                {state === "approving"
                  ? (t('cliAuthorize.authorizing') as string)
                  : (t('cliAuthorize.authorizeButton') as string)}
              </button>
            </div>

            {state === "error" && (
              <p className="text-terminal-red text-xs">
                {t('cliAuthorize.errorGeneric') as string}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

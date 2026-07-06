"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/posthog";

function messageFromReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export function ClientErrorReporter() {
  useEffect(() => {
    function reportClientError(source: string, error: unknown) {
      trackEvent("client_error", {
        source,
        message: messageFromReason(error).slice(0, 500),
      });
    }

    function onError(event: ErrorEvent) {
      reportClientError("window_error", event.error ?? event.message);
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      reportClientError("unhandledrejection", event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

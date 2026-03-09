"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ToastProps {
  message: string;
  /** Optional secondary line (e.g. "Score: 58 → 61") */
  detail?: string;
  type: "loading" | "success" | "error" | "info";
  /** Auto-dismiss after ms. 0 = persistent until manually dismissed. Default: 4000 */
  duration?: number;
  onDismiss?: () => void;
}

const TYPE_ICONS: Record<ToastProps["type"], React.ReactNode> = {
  loading: (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="50 14"
        strokeLinecap="round"
      />
    </svg>
  ),
  success: (
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
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
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
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
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
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

const TYPE_COLORS: Record<ToastProps["type"], string> = {
  loading: "text-amber",
  success: "text-terminal-green",
  error: "text-terminal-red",
  info: "text-text-secondary",
};

export function Toast({
  message,
  detail,
  type,
  duration = 4000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (duration <= 0) return;
    const hideTimer = setTimeout(() => setVisible(false), duration);
    const dismissTimer = setTimeout(
      () => onDismissRef.current?.(),
      duration + 300,
    );
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed top-5 right-5 z-[9998] flex items-start gap-3
        rounded-xl border border-stroke bg-card px-4 py-3
        shadow-xl shadow-stroke/20 backdrop-blur-sm
        max-w-sm min-w-[280px]
        ${visible ? "animate-scale-in" : "animate-toast-out"}
      `}
    >
      <span className={`mt-0.5 flex-shrink-0 ${TYPE_COLORS[type]}`}>
        {TYPE_ICONS[type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{message}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
        )}
      </div>
      {onDismiss && type !== "loading" && (
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-full p-1 text-text-secondary transition-colors hover:text-text-primary"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>,
    document.body,
  );
}

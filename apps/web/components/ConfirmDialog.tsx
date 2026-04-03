"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // Focus Cancel button — safe default for destructive dialogs
      cancelRef.current?.focus();
    }
    // Note: !open → component returns null above, so dialog is already removed from DOM.
    // dialog.close() is not needed here.
  }, [open]);

  if (!open) return null;

  const titleId = "confirm-dialog-title";
  const descId = "confirm-dialog-desc";

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={onCancel}
      className="m-auto max-w-sm w-full rounded-2xl border border-stroke bg-card p-6 shadow-xl backdrop:bg-black/50"
    >
      <h2
        id={titleId}
        className="font-heading text-base font-semibold text-text-primary"
      >
        {title}
      </h2>
      <p
        id={descId}
        className="mt-2 font-body text-sm leading-relaxed text-text-secondary"
      >
        {description}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          ref={cancelRef}
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="rounded-lg border border-stroke px-4 py-2 text-sm text-text-secondary transition-colors hover:border-amber/20 hover:text-text-primary disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
            variant === "destructive"
              ? "bg-terminal-red hover:bg-terminal-red/80"
              : "bg-amber hover:bg-amber-light"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
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
                  strokeWidth="3"
                  strokeDasharray="31.4 31.4"
                  strokeLinecap="round"
                />
              </svg>
              {confirmLabel}
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </dialog>
  );
}

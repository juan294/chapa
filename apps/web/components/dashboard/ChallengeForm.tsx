"use client";

import { useCallback, useId, useState } from "react";
import type { FormEvent } from "react";
import { StatusCallout } from "@/components/StatusCallout";
import {
  MAX_CHALLENGE_REASON_LENGTH,
  MIN_CHALLENGE_REASON_LENGTH,
} from "@/lib/challenge/validation";
import { useTranslation } from "@/lib/i18n";

type FormView = "cta" | "form" | "success" | "error";

interface ChallengeFormProps {
  handle: string;
}

export function ChallengeForm({ handle }: ChallengeFormProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const errorId = useId();
  const [view, setView] = useState<FormView>("cta");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const trimmed = reason.trim();

      if (trimmed.length < MIN_CHALLENGE_REASON_LENGTH) {
        setValidationError(t("scoreExplanation.challenge.validationMinLength") as string);
        return;
      }

      if (trimmed.length > MAX_CHALLENGE_REASON_LENGTH) {
        setValidationError(t("scoreExplanation.challenge.validationMaxLength") as string);
        return;
      }

      setSubmitting(true);
      setValidationError("");
      setErrorMessage("");

      try {
        const res = await fetch("/api/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle, reason: trimmed }),
        });

        if (res.ok) {
          setView("success");
        } else if (res.status === 429) {
          setErrorMessage(t("scoreExplanation.challenge.tooManyRequests") as string);
          setView("error");
        } else {
          setErrorMessage(t("scoreExplanation.challenge.errorText") as string);
          setView("error");
        }
      } catch {
        setErrorMessage(t("scoreExplanation.challenge.errorText") as string);
        setView("error");
      } finally {
        setSubmitting(false);
      }
    },
    [handle, reason, t],
  );

  const handleCancel = useCallback(() => {
    setView("cta");
    setReason("");
    setValidationError("");
    setErrorMessage("");
    setSubmitting(false);
  }, []);

  if (view === "success") {
    return (
      <StatusCallout
        variant="success"
        title={t("scoreExplanation.challenge.successTitle") as string}
        description={t("scoreExplanation.challenge.successDescription") as string}
        titleAs="h4"
        className="p-4 text-sm"
      />
    );
  }

  if (view === "cta") {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setView("form")}
          className="text-xs text-text-secondary underline decoration-dashed underline-offset-2 transition-colors hover:text-text-primary motion-reduce:transition-none"
        >
          {t("scoreExplanation.challenge.ctaButton") as string}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <h4 className="font-heading text-sm font-bold text-text-primary">
        {t("scoreExplanation.challenge.heading") as string}
      </h4>
      <p className="text-xs leading-relaxed text-text-secondary">
        {t("scoreExplanation.challenge.intro") as string}
      </p>

      <div>
        <label
          htmlFor={reasonId}
          className="mb-1 block text-xs font-medium text-text-secondary"
        >
          {t("scoreExplanation.challenge.label") as string}
        </label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setValidationError("");
          }}
          placeholder={t("scoreExplanation.challenge.placeholder") as string}
          maxLength={MAX_CHALLENGE_REASON_LENGTH}
          rows={4}
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? errorId : undefined}
          className="w-full resize-none rounded-lg border border-stroke bg-track/40 px-3 py-2 text-sm text-text-primary transition-colors placeholder:text-text-secondary/50 focus:border-amber/40 focus:ring-1 focus:ring-amber/30 focus-visible:outline-none motion-reduce:transition-none"
        />
        {validationError && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-terminal-red">
            {validationError}
          </p>
        )}
      </div>

      {view === "error" && errorMessage && (
        <p role="alert" className="text-xs text-terminal-red">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {submitting
            ? (t("scoreExplanation.challenge.submitting") as string)
            : (t("scoreExplanation.challenge.submit") as string)}
        </button>
        {!submitting && (
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-text-secondary transition-colors hover:text-text-primary motion-reduce:transition-none"
          >
            {t("scoreExplanation.challenge.cancel") as string}
          </button>
        )}
      </div>
    </form>
  );
}

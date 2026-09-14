"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * The opt-in that turns a subject's score from a legacy v6 aggregate into an
 * issued v7 receipt.
 *
 * Policy requires the publication consequence to be stated *before* consent is
 * given, not after: an issued receipt is public and replayable, and historical
 * independent downloads cannot be recalled by a later withdrawal. That sentence
 * is therefore part of the control rather than a link away from it.
 *
 * Withdrawal is offered in the same place and revokes public access to the
 * issued receipts, leaving a content-free tombstone. It is deliberately not an
 * account deletion flow (that stays out of scope, per the settings ownership
 * note) — it withdraws publication only.
 */
export function PublicationConsent({ handle, initialConsent }: { handle: string; initialConsent: boolean }) {
  const { t } = useTranslation();
  const [consented, setConsented] = useState(initialConsent);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(enabled: boolean) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "consent",
          owner: handle.toLowerCase(),
          enabled,
          publicationAcknowledged: true,
        }),
      });
      if (!response.ok) {
        setError(t("settings.consentError") as string);
        return;
      }
      setConsented(enabled);
    } catch {
      setError(t("settings.consentError") as string);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="settings-consent" className="border-t border-stroke pt-8">
      <h2 id="settings-consent" className="font-heading text-lg font-semibold tracking-tight text-text-primary">
        {t("settings.consentTitle") as string}
      </h2>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-text-secondary">
        {t("settings.consentDescription") as string}
      </p>
      <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-text-secondary">
        {t("settings.consentConsequence") as string}
      </p>

      <p className="mt-4 text-sm text-text-primary">
        {t(consented ? "settings.consentStateOn" : "settings.consentStateOff") as string}
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => void submit(!consented)}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[3px] bg-action px-6 py-3 font-heading text-sm font-semibold text-action-text hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-amber-text disabled:opacity-60"
      >
        {t(consented ? "settings.consentWithdraw" : "settings.consentGrant") as string}
      </button>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-terminal-red">
          {error}
        </p>
      ) : null}
    </section>
  );
}

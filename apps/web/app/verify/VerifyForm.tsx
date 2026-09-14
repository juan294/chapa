"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { VERIFICATION_CODE_PATTERN, VERIFICATION_CODE_MAX_LENGTH } from "@/lib/verification/constants";

export function VerifyForm() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = hash.trim().toLowerCase();
    if (!VERIFICATION_CODE_PATTERN.test(trimmed)) {
      setError(t('verifyForm.invalidHash') as string);
      return;
    }
    router.push(`/verify/${trimmed}?lang=${locale}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="hash-input"
          className="block text-xs font-medium uppercase tracking-wider text-text-secondary mb-2"
        >
          {t('verifyForm.label') as string}
        </label>
        <input
          id="hash-input"
          type="text"
          value={hash}
          onChange={(e) => {
            setHash(e.target.value);
            setError("");
          }}
          placeholder="a1b2c3d4e5f6a7b8"
          maxLength={VERIFICATION_CODE_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "hash-input-error" : undefined}
          className="w-full rounded-[3px] border border-text-primary bg-card px-4 py-3 font-heading text-lg tracking-widest text-text-primary placeholder:text-text-secondary focus:border-complement-text focus-visible:outline-complement-text! transition-colors"
        />
        {error && (
          <p id="hash-input-error" role="alert" className="mt-2 text-sm text-terminal-red">{error}</p>
        )}
      </div>

      <button
        type="submit"
        className="group inline-flex min-h-[46px] items-center gap-2.5 rounded-[3px] border border-complement-text bg-card px-6 font-heading text-sm font-semibold text-complement-text transition-colors hover:bg-purple-tint focus-visible:outline-complement-text!"
      >
        {t('verifyForm.submit') as string}
        <svg
          className="w-4 h-4 transition-transform group-hover:translate-x-1"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M12 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  );
}

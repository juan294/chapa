"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const HASH_PATTERN = /^[0-9a-f]{8}([0-9a-f]{8})?$/;

export function VerifyForm() {
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = hash.trim().toLowerCase();
    if (!HASH_PATTERN.test(trimmed)) {
      setError("Enter a valid 8 or 16 character hex hash (e.g. a1b2c3d4e5f6a7b8).");
      return;
    }
    router.push(`/verify/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="hash-input"
          className="block text-xs font-medium uppercase tracking-wider text-text-secondary mb-2"
        >
          Verification Hash
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
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-stroke bg-card px-4 py-3 font-heading text-lg tracking-widest text-text-primary placeholder:text-text-secondary/30 focus:border-complement/40 focus-visible:outline-none focus:ring-1 focus:ring-complement/50 transition-colors"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-terminal-red">{error}</p>
        )}
      </div>

      <button
        type="submit"
        className="group inline-flex items-center gap-2.5 rounded-lg bg-complement px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-complement/80 hover:shadow-xl hover:shadow-complement/25"
      >
        Verify
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

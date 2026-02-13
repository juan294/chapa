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
          className="w-full rounded-lg border border-stroke bg-card px-4 py-3 font-heading text-lg tracking-widest text-text-primary placeholder:text-text-secondary/30 focus:border-amber/40 focus:outline-none focus:ring-1 focus:ring-amber/20 transition-colors"
        />
        {error && (
          <p className="mt-2 text-sm text-terminal-red">{error}</p>
        )}
      </div>

      <button
        type="submit"
        className="rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25"
      >
        Verify
      </button>
    </form>
  );
}

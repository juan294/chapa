# Phase 4 — ChallengeForm Component + Panel Wiring

**Depends on:** Phase 1 (i18n keys) and Phase 3 (API route exists)

**Goal:** Create the inline `ChallengeForm` client component, wire it into `ScoreExplanationPanel`, and update tests.

**New files:**
- `apps/web/components/dashboard/ChallengeForm.tsx`
- `apps/web/components/dashboard/ChallengeForm.test.tsx`

**Modified files:**
- `apps/web/components/dashboard/ScoreExplanationPanel.tsx` (import + render ChallengeForm)
- `apps/web/components/dashboard/ScoreExplanationPanel.test.tsx` (owner vs visitor assertions)

---

## State Machine

```
"cta"     — initial state: single ghost button "Something seem off?"
  ↓ click
"form"    — textarea + cancel + submit visible
  ↓ submit (valid)
"loading" — submit button shows "Sending...", aria-busy=true, disabled; cancel hidden
  ↓ 200 ok
"success" — form replaced by StatusCallout variant="success"
  ↓ 429
"error"   — form stays open, tooManyRequests message shown above submit
  ↓ other error
"error"   — form stays open, errorText message shown above submit
```

Cancel button (shown in "form" and "error" states) resets to "cta".

---

## Red — Failing Tests

Write `ChallengeForm.test.tsx` first:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChallengeForm } from "./ChallengeForm";

afterEach(cleanup);

// Mock useTranslation to return keys as values (standard test pattern)
vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "en", setLocale: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("ChallengeForm", () => {
  it("shows the CTA button initially, not the form", () => {
    render(<ChallengeForm handle="octocat" />);
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("reveals the form when CTA button is clicked", () => {
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.cancel" })).toBeTruthy();
  });

  it("shows validation error for reason shorter than 20 chars", () => {
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Too short" } });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("scoreExplanation.challenge.validationMinLength")).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("cancel button returns to CTA state", () => {
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.cancel" }));
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("disables submit and shows submitting label during loading", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    const submitBtn = screen.getByRole("button", { name: "scoreExplanation.challenge.submitting" });
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.getAttribute("disabled")).not.toBeNull();
    expect(submitBtn.getAttribute("aria-busy")).toBe("true");
  });

  it("shows success callout after 200 response", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    await waitFor(() => {
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText("scoreExplanation.challenge.successTitle")).toBeTruthy();
    });
  });

  it("shows tooManyRequests message on 429 response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    await waitFor(() => {
      expect(screen.getByText("scoreExplanation.challenge.tooManyRequests")).toBeTruthy();
      // Form stays open so user understands what happened
      expect(screen.getByRole("textbox")).toBeTruthy();
    });
  });

  it("shows generic error message on 500 response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    await waitFor(() => {
      expect(screen.getByText("scoreExplanation.challenge.errorText")).toBeTruthy();
    });
  });

  it("sends fetch to /api/challenge with handle and reason", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<ChallengeForm handle="octocat" />);
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/challenge");
    expect(opts.method).toBe("POST");
    const parsedBody = JSON.parse(opts.body);
    expect(parsedBody).toEqual({
      handle: "octocat",
      reason: "My delivery score seems wrong because my PRs are not counted.",
    });
  });
});
```

---

## Green — ChallengeForm Component

```tsx
// apps/web/components/dashboard/ChallengeForm.tsx
"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { StatusCallout } from "@/components/StatusCallout";

type FormView = "cta" | "form" | "success" | "error";

interface ChallengeFormProps {
  handle: string;
}

const MIN_REASON_LENGTH = 20;
const MAX_REASON_LENGTH = 1000;

export function ChallengeForm({ handle }: ChallengeFormProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<FormView>("cta");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = reason.trim();

      // Client-side validation
      if (trimmed.length < MIN_REASON_LENGTH) {
        setValidationError(t("scoreExplanation.challenge.validationMinLength") as string);
        return;
      }
      if (trimmed.length > MAX_REASON_LENGTH) {
        setValidationError(t("scoreExplanation.challenge.validationMaxLength") as string);
        return;
      }

      setSubmitting(true);
      setValidationError("");

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
  }, []);

  if (view === "success") {
    return (
      <StatusCallout
        variant="success"
        title={t("scoreExplanation.challenge.successTitle") as string}
        description={t("scoreExplanation.challenge.successDescription") as string}
        titleAs="h4"
        className="text-sm"
      />
    );
  }

  if (view === "cta") {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setView("form")}
          className="text-xs text-text-secondary underline decoration-dashed underline-offset-2 hover:text-text-primary transition-colors motion-reduce:transition-none"
        >
          {t("scoreExplanation.challenge.ctaButton") as string}
        </button>
      </div>
    );
  }

  // "form" and "error" states — form stays open on error
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
          htmlFor="challenge-reason"
          className="block text-xs font-medium text-text-secondary mb-1"
        >
          {t("scoreExplanation.challenge.label") as string}
        </label>
        <textarea
          id="challenge-reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setValidationError("");
          }}
          placeholder={t("scoreExplanation.challenge.placeholder") as string}
          maxLength={MAX_REASON_LENGTH}
          rows={4}
          aria-invalid={!!validationError}
          aria-describedby={validationError ? "challenge-validation-error" : undefined}
          className="w-full rounded-lg border border-stroke bg-track/40 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-amber/40 focus-visible:outline-none focus:ring-1 focus:ring-amber/30 transition-colors motion-reduce:transition-none resize-none"
        />
        {validationError && (
          <p
            id="challenge-validation-error"
            role="alert"
            className="mt-1 text-xs text-terminal-red"
          >
            {validationError}
          </p>
        )}
      </div>

      {(view === "error") && errorMessage && (
        <p role="alert" className="text-xs text-terminal-red">
          {errorMessage}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-xs font-semibold text-white transition-all motion-reduce:transition-none hover:bg-amber-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? (t("scoreExplanation.challenge.submitting") as string)
            : (t("scoreExplanation.challenge.submit") as string)}
        </button>
        {!submitting && (
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors motion-reduce:transition-none"
          >
            {t("scoreExplanation.challenge.cancel") as string}
          </button>
        )}
      </div>
    </form>
  );
}
```

---

## ScoreExplanationPanel wiring

Add after the `{isOwner && <section>confidence</section>}` block (currently line 264), inside the `<div className="space-y-6 ...">` content wrapper:

```tsx
// Add import at top of ScoreExplanationPanel.tsx:
import { ChallengeForm } from "@/components/dashboard/ChallengeForm";

// Add after the confidence section (inside the same space-y-6 div):
{isOwner && (
  <section className="border-t border-stroke pt-4">
    <ChallengeForm handle={stats.handle} />
  </section>
)}
```

Note: `stats.handle` is already in scope — the panel receives `stats: StatsData` as a prop.

---

## ScoreExplanationPanel.test.tsx updates

Add two assertions to the existing test file:

```tsx
it("does not render ChallengeForm for visitors", () => {
  renderPanel(false);
  expandPanel();
  // CTA button is owner-only
  expect(
    screen.queryByRole("button", { name: /something seem off/i }),
  ).toBeNull();
});

it("renders ChallengeForm CTA for owners", () => {
  renderPanel(true);
  expandPanel();
  expect(
    screen.getByRole("button", { name: "Toggle how your score is calculated" }),
  ).toBeTruthy();
  // ChallengeForm renders in "cta" view — look for the link/button
  // (exact label comes from t() mock which returns the key)
  expect(
    screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }),
  ).toBeTruthy();
});
```

---

## Verification

```bash
pnpm run test apps/web/components/dashboard/ChallengeForm.test.tsx
pnpm run test apps/web/components/dashboard/ScoreExplanationPanel.test.tsx
pnpm run typecheck
pnpm run lint
pnpm run check:circular
```

Passed with the full-suite build gate as part of final verification.

---

## Implementation Status

- [x] Phase 4 implemented in worktree `/Users/juan/code/chapa-phase-1` on branch `implement/challenge-my-score-phase-1`
- [x] Red state confirmed: `ChallengeForm` test failed before component creation
- [x] Red state confirmed: `ScoreExplanationPanel` owner CTA assertion failed before wiring
- [x] `ChallengeForm` added with CTA, form, loading, success, validation, 429, generic error, cancel, and `/api/challenge` submission states
- [x] `ScoreExplanationPanel` renders the form for owners only when expanded
- [x] `StatusCallout` accepts `h4` titles for nested callout semantics
- [x] Plan-compliance review approved the full implementation
- [x] `/simplify` equivalent completed; `useId`, native button keyboard cleanup, shared validation constants, and test helper cleanup applied
- [x] Verification passed: `pnpm run test apps/web/components/dashboard/ChallengeForm.test.tsx`
- [x] Verification passed: `pnpm run test apps/web/components/dashboard/ScoreExplanationPanel.test.tsx`
- [x] Verification passed: `pnpm run typecheck`
- [x] Verification passed: `pnpm run lint`
- [x] Verification passed: `pnpm run check:circular`
- [x] Final full gates passed: `pnpm run test ; pnpm run typecheck ; pnpm run lint ; pnpm run check:circular ; pnpm run build`
- [x] Bundle-size gate passed: `bash scripts/check-bundle-size.sh 350` (largest client JS chunk: 227 KB)

All new tests green. Existing ScoreExplanationPanel tests still green. No type errors. No lint violations. No circular deps introduced.

---

## Final full-suite check

```bash
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run check:circular
```

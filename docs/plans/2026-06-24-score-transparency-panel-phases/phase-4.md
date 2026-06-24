# Phase 4 — Reconcile confidence exposure (JSON-LD + docs) `[batch-eligible]`

> Depends on: nothing in code (parallel-safe with Phase 3 — disjoint files). Its wording must describe the owner-only confidence behavior decided up front, so there is no real coupling.
> Files: `apps/web/app/u/[handle]/page.tsx`, `CLAUDE.md`, `docs/impact-v6.md`, `docs/accepted-risks.md`.

## Why this phase exists

Two existing facts contradict the chosen "confidence is owner-only" behavior. Without fixing them the owner-only gate in Phase 3 is cosmetic, and the docs are wrong:

1. **JSON-LD leaks confidence publicly.** `app/u/[handle]/page.tsx:195` emits, in a public `<script type="application/ld+json">`, `...and ${impact.confidence}% confidence.` — readable by anyone viewing source / crawlers, for any handle. This must not expose a value Phase 3 hides from visitors.
2. **CLAUDE.md says confidence is never shown.** Acceptance criteria state: "Confidence is computed internally but not shown to users." We are now showing it to the owner.

## Changes

### 1. Strip confidence from public JSON-LD (`page.tsx:195`)
The JSON-LD `description` is server-rendered into public HTML with no owner context, so the only correct option is to remove the confidence clause entirely.

```
// before (page.tsx:195)
description: `Developer with a Chapa Impact Score of ${impact.adjustedComposite} (${impact.tier} tier) and ${impact.confidence}% confidence.`
// after
description: `Developer with a Chapa Impact Score of ${impact.adjustedComposite} (${impact.tier} tier).`
```
- Check `page.tsx` for any test asserting the old JSON-LD string and update it.

### 2. Update CLAUDE.md acceptance criterion
Replace the line under "Acceptance criteria":
```
// before
- `/u/:handle` shows badge + breakdown + embed snippet. Confidence is computed internally but not shown to users.
// after
- `/u/:handle` shows badge + breakdown + embed snippet. Confidence (% + penalty flags) is shown only to the
  profile owner in the "How is my score calculated" panel; it is hidden from visitors and excluded from public
  metadata (JSON-LD).
```

### 3. Note the behavior in `docs/impact-v6.md`
Add a short line in the confidence/pipeline section recording that confidence is surfaced to the owner via the share-page transparency panel (it was previously display-internal). Keep it factual, one or two sentences.

### 4. Record the per-platform signal gap in `docs/accepted-risks.md`
The panel now openly explains that GitLab/Bitbucket/Codeberg do not provide PR-hygiene signals (so Quality reads low for those profiles). Add an accepted-risk entry so it is treated as intentional, not an audit warning:

```
### Per-platform quality-signal availability
- Risk: PR-description / feature-branch / issue-linkage / batch-size / lead-time signals are computed only
  from GitHub. GitLab, Bitbucket, and Codeberg do not expose them, so a profile whose merged work is mostly
  on those platforms has a Quality dimension based on limited data (and, for solo profiles, Quality is
  display-only and excluded from the composite anyway).
- Mitigation: The share-page "How is my score calculated" panel states this per platform; Quality is never
  counted in the solo composite, so the gap does not depress the headline score for solo developers.
- Severity: Low — Accepted: 2026-06-24
```

## Tests / verification
- Update any snapshot/string test touching the JSON-LD description.
- `pnpm run test && pnpm run typecheck && pnpm run lint` green.
- Grep to confirm no remaining public surface prints `impact.confidence` to non-owners: `grep -rn "confidence" apps/web/app/u apps/web/components | grep -vi test` — only the owner-gated panel path should reference it for display.

## Success criteria
- Automated: full suite green; JSON-LD no longer contains `confidence`.
- Manual: view-source on a `/u/:handle` page (as a visitor) shows no confidence value anywhere; CLAUDE.md / impact-v6 / accepted-risks read consistently with the shipped behavior.

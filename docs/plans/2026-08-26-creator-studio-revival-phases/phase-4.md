# Phase 4 — Documentation refresh [batch-eligible]

Docs-only; no code. Fixes research §5.6.

1. `docs/spec.md:17` — "Configuration persisted via Redis" → "Configuration
   persisted in Supabase (`studio_configs`, source of truth) with Redis as
   the hot read path (#935, migration 027)".
2. `docs/user-manual.md` — Studio chapter (:43-224): add one availability
   note at the top of the chapter: gated by the `studio_enabled` feature
   flag; state the current default. Align the `:417` "(if enabled)" hedge
   wording with it. Update the landing-page table at `:27` likewise.
3. `docs/demo.md:47-55` — mark the Studio beat as flag-dependent (one line;
   the beat itself stays — it becomes accurate after Phase 5).
4. Sweep: `grep -rn "persisted via Redis\|Redis (TTL" docs/` for any other
   stale persistence claims; fix in the same commit.

AMENDMENT (2026-08-26, found during /implement): `docs/user-manual.md:326`
falsely claims "Your badge at `/u/<handle>/badge.svg` will reflect the saved
settings" — the config→SVG pipeline never existed (research §4). Approved
replacement:
> Persists your badge configuration server-side. The saved configuration is
> restored when you return to Creator Studio; it does not change the public
> SVG badge.
5. Extend the sweep to rendering claims too: `grep -rni "reflect the saved\|
   applies to your badge\|custom badge" docs/ README.md` — correct any other
   statement implying saved Studio config changes the public badge or share
   page.

No emojis (standing rule). Success criteria: `pnpm run lint` (docs lint if
configured) and a clean `git diff` review — no automated behavior to test.

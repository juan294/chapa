# Phase 2 — Roll the matrix across every write endpoint + registration-checker gate

**Depends on:** Phase 1 (harness, contract project, Redis fake, `contract` CI job).
**Batch:** no — shares `ci.yml` with Phase 3; sequence them.
**Goal:** every non-exempt write endpoint gets a payload-matrix contract test, and
it becomes impossible to add a new write endpoint without one (or a documented
exemption). Fix the seam bugs the rollout surfaces (incl. Appendix-A bug B).

---

## 2.1 Roll the matrix (Tier 1 → Tier 3)

Using the harness + route classification (main plan §5), add one
`route.contract.test.ts` per write route. Batch the whole rollout into **one PR**
(deployment-safety: don't push one route at a time). Order by risk:

**Tier 1 — durable, null-forwarding / silent-persist risk (loud → persistence re-read):**
- `POST /api/recalculate`, `POST /api/refresh` — snapshot replace. **Surfaces bug B**
  (see §2.3).
- `GET /api/auth/{bitbucket,codeberg,gitlab}/callback` — shared
  `dbUpsertLinkedPlatform` with `refresh_token ?? null` / null `expiresAt`
  (`lib/auth/platform-oauth.ts:257`). Drive the three via the shared factory; assert
  `user_platforms` row persists with null tokens intact.
- `PUT /api/studio/config` — assert `studio_configs` row matches saved config.
- `GET /api/auth/callback` — `graceful`; no-5xx + capture-on-`dbUpsertUser`-failure.

**Tier 2 — durable, lower null risk (loud unless noted):**
- `POST /api/admin/campaigns` (Zod), `PATCH/DELETE /api/admin/campaigns/[id]`,
  `POST .../send`, `POST .../test`, `PATCH /api/admin/feature-flags` (Zod),
  `POST /api/admin/bulk-recalculate`. Seed an admin session/`ADMIN_SECRET`; assert
  the campaign/flag row state after each.
- `POST /api/telemetry` — `graceful` by design: no-5xx only, **no** persistence
  assertion (best-effort sink).
- `POST /api/challenge` — `graceful`: no-5xx (email-only, no durable row).

**Tier 3 — Redis-only / mutating GET (graceful → no-5xx + Redis-state where applicable):**
- `POST /api/cli/auth/approve`, `GET /api/cli/auth/poll`, `GET /api/auth/login`,
  `POST /api/auth/logout`, `POST /api/generate`.
- `GET /api/notifications/unsubscribe` — **loud**: drive with a valid HMAC token,
  assert `users.email_notifications` flipped in Supabase.

Body-less routes (`generate`, `recalculate`) get a single real-stack smoke
invocation instead of a full fuzz, but **stay registered** (§2.2).

Each test: `beforeAll` seed (bounded-retry) → `declareField` the route's payload →
`generatePayloads` → `runMatrix` with the class-appropriate assertion → `afterAll`
best-effort cleanup.

## 2.2 Registration-checker script + CI gate

**New `scripts/check-write-registration.ts`** (mirror `validate-migrations.ts` shape;
run via `tsx`, same as other ratchet scripts in `lint-and-typecheck`):

```
1. DISCOVER write handlers: walk apps/web/app/api/**/route.ts; regex the exported
   methods `export const (POST|PUT|PATCH|DELETE) =` AND `export async function (…)`.
   INCLUDE GET handlers that write — maintain a known-write-GET list:
   auth/login, auth/callback, auth/{platform}/callback, cli/auth/poll,
   notifications/unsubscribe, cron/* (the last are exempt, see below).
2. DISCOVER registered handlers: grep apps/web/**/*.contract.test.ts for imports of
   each route module + the method symbol.
3. EXEMPTION MAP (explicit, reason-annotated):
   {
     "POST /api/webhooks/resend": "Svix HMAC-verified provider payload, not user JSON",
     "GET /api/cron/warm-cache": "CRON_SECRET, no body — freshness gated in Phase 4",
     "GET /api/cron/sync-audience": "CRON_SECRET, no body",
     "GET /api/cron/process-campaigns": "CRON_SECRET, no body",
     "POST /api/admin/agents/run": "dev-only, prod-blocked",
     "DELETE /api/admin/agents/run": "dev-only, prod-blocked",
   }
4. GATE: unregistered = discovered − registered − exempt.
   Print an actionable table; exit 1 if unregistered.length > maxUnregistered (0).
```

**Add to `package.json`:** `"check:write-registration": "tsx scripts/check-write-registration.ts --max-unregistered=0"`.

**Wire into CI:** add a step to the **`contract`** job (it has the route context) —
`- run: pnpm run check:write-registration`. (Do NOT add to `lint-and-typecheck`;
keeping it in `contract` avoids a second `ci.yml` edit locus that would collide with
Phase 3's `e2e` edit.)

**New `scripts/check-write-registration.test.ts`** — unit-test the discovery regex
and exemption logic against fixtures (a fake route dir): a new write handler with no
contract test → reported; an exempt one → not; a registered one → not.

**Adversarial audit of the exemption map** (playbook §4.2): confirm no exempted
route accepts a plain JSON body and writes to Supabase. `notifications/unsubscribe`
writes on GET via HMAC token → **must be registered, not exempt** (it's in Tier 3).

## 2.3 Fix seam bugs surfaced by the rollout

- **Bug B — snapshot NOT-NULL numerics (`apps/web/lib/db/snapshots.ts:113-137`).**
  The `recalculate`/`refresh` contract tests' persistence assertion goes red when a
  numeric is `undefined` → `23502`. Fix: default the NOT-NULL numerics at the write
  boundary (`commits_total: s.commitsTotal ?? 0`, etc.) OR validate the
  `StatsData`/impact object is complete before the write and capture if not. Prefer
  the explicit default at the insert mapping; add a `loud` capture if a required
  field was missing (that indicates an upstream compute bug worth surfacing).
- **Any `.single()` on a write** found during rollout → `.maybeSingle()` +
  `order+limit(1)` (dedup-recovery pattern). (Bug C already handled in Phase 1;
  sweep for siblings — instance-sweep rule.)
- **Blunt-500 audit** (`studio/config`, `supplemental`): if a legal payload trips a
  UNIQUE (`23505`), decide per route whether idempotent-success (200) is correct.
  **Do not** build a central PG-error mapper yet (defer past ~5 sites, playbook §8);
  handle inline where the matrix shows a 5xx on legal input.
- **Wire dead/weak validation** found while enumerating (declared-but-unused schema,
  hand-rolled guard weaker than the DB constraint): tighten or delete, or record in
  `docs/accepted-risks.md`.

## 2.4 Instance-sweep discipline

For every bug fixed here, grep the **signature** (not just the named file) and fix +
test every instance in the same PR (project rule + playbook §9). Record the grep
signature and full `file:line` list in the PR description.

---

## Success criteria

**Automated:**
- [ ] Every route in main-plan §5 (minus exemptions) has a `*.contract.test.ts`;
      all green with **zero 5xx** across their payload spaces.
- [ ] Loud routes assert persistence (re-read); graceful routes assert no-5xx (+
      capture / Redis-state where applicable).
- [ ] `pnpm run check:write-registration` exits 0; deleting one contract test makes
      it exit 1 with an actionable message (verify once).
- [ ] `check-write-registration.test.ts` green.
- [ ] Bug B regression: `recalculate`/`refresh` contract persistence assertion green;
      reverting the fix turns it red.
- [ ] `pnpm run typecheck ; pnpm run lint ; pnpm run test` clean; `contract` job green.

**Manual:**
- [ ] Review the exemption map adversarially — every exempt route is genuinely
      out-of-scope (webhook/cron/dev-only/body-less), none accepts user JSON + writes.
- [ ] PR lists, per bug fixed, the grep signature + full instance list.

## Files touched

- new: ~24 `apps/web/app/api/**/route.contract.test.ts`,
  `scripts/check-write-registration.ts`, `scripts/check-write-registration.test.ts`
- edit: `.github/workflows/ci.yml` (add checker step to `contract` job),
  `package.json`, `apps/web/lib/db/snapshots.ts` (bug B), any route/validation files
  where the matrix surfaces a real 5xx, `docs/accepted-risks.md` (if any accepted).

## GitHub issues

Bug B (`type: bug, priority: high, area: scoring`) + one issue per additional seam
bug the rollout finds. File as found; close on merge to `develop` with green CI.

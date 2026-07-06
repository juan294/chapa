# Phase 3 — Real-journey phone E2E with offline + Supabase re-read

**Depends on:** Phase 1 (real Supabase stack in CI, for the DB re-read).
**Batch:** no — shares `ci.yml` (`e2e` job) with Phase 2; sequence them.
**Goal:** one high-value end-to-end test that drives a complete journey on a **phone
profile**, toggles offline→online, and **re-reads Supabase** to prove per-shape
persistence — the assertions a UI-only, Chromium-only E2E omits.

Chapa's Playwright today is Chromium-desktop-only, no offline, no DB re-read
(`apps/web/playwright.config.ts`, `apps/web/e2e/`).

---

## 3.1 Add a phone Playwright project

**Edit `apps/web/playwright.config.ts`** — add a mobile project beside `chromium`:

```
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "mobile",   use: { ...devices["Pixel 5"] } },        // NEW
]
```

Keep `locale: "es-ES"`. The journey spec must be **viewport-robust** — click
whichever CTA is visible (mobile moves the badge toolbar / share CTA / studio
controls into a sticky bar).

## 3.2 The journey spec

**New `apps/web/e2e/journey.spec.ts`** — a complete session, not a single action:

```
test.describe("full impact journey", () => {
  // Seeded GitHub session (reuse the smoke-suite auth/synthetic-user convention +
  // the __chapa_smoke=1 param where routes support it).
  test("login -> generate -> badge -> studio save -> share -> refresh, with data variety", async ({page, context}) => {
    for each shape in [craftProfile, nonCraftProfile, linkedPlatformProfile]:
      1. Authenticated visit /generating/<handle> -> wait for badge render
      2. GET /u/<handle>/badge.svg -> assert 200 image/svg+xml, correct radar
         (pentagon for craft, diamond for non-craft), platform logos for linked
      3. /studio -> change a visual category -> Save -> assert success UI
      4. /u/<handle> -> assert breakdown + embed snippet render
      // OFFLINE segment:
      5. context.setOffline(true) -> trigger a studio save or owner-cache-warm ->
         assert queued/unsaved UI + local-storage/owner-cache state
      6. context.setOffline(false) -> assert the queue flushes (useOwnerCacheWarm /
         useSession retry path) and the save lands
      7. Refresh via UI -> assert updated state
  })
})
```

Data variety is the point: the three shapes are three different persistence shapes
through the same paths — exactly where the NOT-NULL snapshot drop (bug B) and the
`after()` truncation (bug D) hide.

## 3.3 The Supabase re-read (the crux)

At journey end, query Supabase directly with the service-role client and assert
per-shape correctness:

```
after the journey, using the same service client as the contract tests:
  snapshot = from("metrics_snapshots").select("*").eq("handle", handle)
             .eq("date", today).maybeSingle()
  expect(snapshot).not.toBeNull()
  // per shape:
  craftProfile      -> expect(snapshot.craft).toBeGreaterThan(0)   // NOT null
  nonCraftProfile   -> expect(snapshot.craft).toBeNull()           // bug B territory
  // NOT-NULL numerics all present & finite (no silent 23502 drop)
  config = from("studio_configs").select("*").eq("handle", handle).maybeSingle()
  expect(config).toMatchObject(savedConfig)
  linkedPlatformProfile -> from("user_platforms") row present w/ tokens intact
```

This is the assertion that catches silent data loss. If bug B or D regresses, a
snapshot row is missing or `craft` is wrongly null → red here.

## 3.4 Realistic fixtures + retry-safety

- **Realistic seed:** fixtures that mirror what the real stats pipeline emits (all
  optional columns populated: `craft`, `micro_commit_ratio`, `docs_only_pr_ratio`,
  `confidence_penalties`), not minimal rows — otherwise the nullable columns that
  break are never exercised.
- **Retry-safety:** dedicated fixture handles per shape; per-test reset (delete the
  handle's rows) so CI's 2 retries start clean and the journey never collides with
  other specs' fixtures.
- **Seed-count coupling (playbook §8):** grep existing specs for `toHaveCount` /
  strict `DEPLOYMENT_SMOKE_STRICT` assertions before adding fixtures; don't inflate a
  counted view. Use distinct handles that no other spec asserts on.

## 3.5 Wire into CI

**Edit `.github/workflows/ci.yml` `e2e` job** — the journey needs a real Supabase to
re-read, which the current `e2e` job (dummy env, no DB) doesn't have. Options
(pick the lower-cost that works):

- **Preferred:** run `journey.spec.ts` inside the **`contract` job** (it already has
  `supabase start` up) as a Playwright-against-`next start` step, OR add
  `supabase start` to the `e2e` job. Boot the app against the local stack's env so
  the re-read and the app share one DB.
- Run on **both** projects: `npx playwright test e2e/journey.spec.ts --project=chromium --project=mobile`.
- Keep the existing degraded-mode smoke specs as-is (they intentionally tolerate no
  DB); the journey is the strict, DB-backed addition.

Note: this is the `ci.yml` edit that collides with Phase 2's checker step — land
Phase 2 first (or coordinate both edits into distinct job blocks).

---

## Success criteria

**Automated:**
- [ ] `mobile` (Pixel 5) Playwright project runs in CI.
- [ ] `journey.spec.ts` passes on **both** `chromium` and `mobile`, covering craft /
      non-craft / linked-platform shapes.
- [ ] Offline→online segment asserts queued UI then auto-flush.
- [ ] The Supabase re-read confirms per-shape persistence (snapshot present, `craft`
      null/non-null correctly, studio config matches, platform row intact).
- [ ] Reverting bug B (or D, once Phase 4 lands) turns the re-read assertion red.

**Manual:**
- [ ] Watch a trace/video of the mobile run — CTAs are actually reachable on the
      phone viewport (no hidden/covered primary action).
- [ ] Confirm fixtures use distinct handles that don't perturb existing count
      assertions.

## Files touched

- new: `apps/web/e2e/journey.spec.ts`, journey fixtures/helpers under
  `apps/web/e2e/` (or `apps/web/test/e2e-fixtures/`)
- edit: `apps/web/playwright.config.ts` (mobile project),
  `.github/workflows/ci.yml` (`e2e` or `contract` job runs the journey w/ real DB)

## GitHub issues

If the journey surfaces a new persistence bug (e.g. a shape that drops a column),
file `type: bug` + area; fix in this phase or defer to a follow-up with a linked
issue.

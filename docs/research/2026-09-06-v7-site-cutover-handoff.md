# v7 site cutover — implementation handoff for validation

Date: 2026-09-06
Branch: `feature/v7-site-cutover`
Commits: `88891334` (cutover), `81ece18e` (this doc), `dea4eb54` (label fix),
plus the flag commit below.

> **Status after independent review (2026-09-06): the runtime is OFF by
> default behind `scoring_v7_rendering`.** The review found that the cutover
> reached the badge and nothing else, so enabling it would publish two
> different numbers for one revision. See §9.
Base: `develop` @ `548940d3`

This document exists so an independent agent can validate the change without
re-deriving it. It records what was done, why each decision was made, what was
verified, and — most importantly — what was **not** done and what is risky.

This work did **not** follow the RPI cycle. It began as a documentation
question ("is `/about/scoring` updated for v7?") and grew into a runtime
cutover after the scope was widened mid-task. Treat it as unreviewed
implementation, not as a validated phase.

---

## 1. The state that prompted it

`/about/scoring` described Impact v6 arithmetic. Only the Craft section and the
claim-level phrasing had been rewritten to v7, by S17 / #1312 (`f62dd1e3`).
Everything describing the core — caps, dimension weights, the composite
formula, the confidence-penalty table, EMA smoothing — was still v6.

S17 is marked `verified` in
`docs/plans/2026-09-05-scoring-relaunch-phases/implementation-progress.json`.
It reads verified because its gate, `lib/i18n/dictionaries/claims.test.ts`,
checks four claim-level rules plus Craft separateness. **It never checks the
arithmetic.** That gap is why stale v6 formulas survived a "verified" task, and
it is still open: nothing in the suite compares published copy against
`SCORING_V7_POLICY`.

Investigation then found the larger problem: the copy was not the only thing
that was not v7. The **runtime** was not either.

- `lib/profile/materialize-profile.ts:83` called `computeImpactV6`.
- `lib/profile/score-view-model.ts` exported `legacyViewModel` and
  `renderableScore` with **no production consumers at all** — built in S15/S16
  for a cutover that never happened.
- `app/api/profile/[handle]/route.ts` returned `scoring: null`, because
  `readScoreReceiptV7` found no receipt for anyone.
- Nothing anywhere issued a receipt outside that read path.
- Nothing exposed publication consent, without which
  `materializeScoreReceiptV7` returns `not_consented` and refuses to issue.

So the badge, share page, OG image and leaderboard all published v6 numbers,
and no code path could ever have changed that.

## 2. The decision taken

The user was offered three options: copy only; copy plus a runtime cutover; or
copy plus v7 behind a feature flag. **The user chose copy plus runtime
cutover**, with the following stated on the record before they chose:

> this ships v7 to production scores without the S18 pilot that `policy.md`
> names a relaunch blocker.

S18 (`#1313`, phase 14) is `blocked-pending-human-pilot`. S19 (`#1314`, phase
15) is the migration/rollout task and was **not** executed — see §7.

## 3. What changed

### 3.1 One resolver — `apps/web/lib/profile/score-model.ts` (new)

`resolveScoreModel(handle, impact)` returns an issued v7 receipt projected via
`receiptViewModel`, or the v6 aggregate via `legacyViewModel`, labelled `v6`.
`scoreModelFrom(handle, impact, receipt)` is the same decision once the receipt
read has already happened, so materialization can read the receipt concurrently
with stats instead of serializing it behind the GitHub fetch.

**The v6 fallback is deliberate and load-bearing.** `/u/:handle` accepts any
handle on earth (a README embed of a stranger's badge). Such a subject has no
ledger, no consent, and therefore no receipt. Failing closed would blank every
embedded badge that is not a registered, consented account.

### 3.2 The badge draws from the model — `lib/render/BadgeSvg.tsx`

Previously the badge read `impact.dimensions`, `impact.adjustedComposite`,
`impact.tier`, `impact.archetype` directly. It now builds
`renderableScore(scoring ?? legacyViewModel(impact))` and draws from that.

Behavioral differences, all v7-only:

| Case | Before | Now |
| --- | --- | --- |
| v6 aggregate | point score, tier, archetype, Craft pentagon | **identical** (see §5.1) |
| v7 point | n/a | same shape as v6 |
| v7 range | n/a | headline prints `lower–upper`; ring drawn at the lower bound |
| v7 range straddling a tier boundary | n/a | no tier; label reads "evidence range" |
| v7 any non-point dimension | n/a | no archetype; label reads "insufficient evidence" |
| Craft radar axis | 5th axis when present | **v6 only.** A v7 badge draws the diamond; Craft is separate and never a core axis |

`getTierColor` and `getArchetypeColor` (`lib/render/theme.ts`) were widened to
accept `null`, which is a real v7 result rather than a missing value; both take
the neutral secondary ink, because the honest reading is "not labelled", not
"labelled poorly".

Headline font size gained a `> 4` step (30px) so a five-character interval
stays inside the score backing. **This is unverified visually** — see §7.

### 3.3 The model reaches every render surface

`MaterializedProfile` and `MaterializedDisplayProfile` now carry
`scoring: ScoreViewModel`. `materializeProfile` reads the receipt inside its
existing `Promise.allSettled` block (a failed read falls back to the labelled
v6 aggregate). Passed to `renderBadgeSvg` from:

- `app/u/[handle]/badge.svg/route.ts`
- `app/u/[handle]/og-image/route.ts`
- `app/u/[handle]/page.tsx`
- `app/api/cron/warm-cache/route.ts`

### 3.4 Receipt issuance — `apps/web/lib/profile/issue-receipt.ts` (new)

`issueScoreReceiptIfConsented(handle, {token})` wraps
`materializeScoreReceiptV7`. Called from `/api/generate`, `/api/refresh`,
`/api/recalculate` and the warm-cache cron. **Never from a public read** —
issuing on a badge hit would publish a durable artifact for whoever happened to
be embedded, the mistake #1239 fixed for the `users` table.

`not_consented` is silent (it is the normal answer for nearly every subject);
only `storage_error` and thrown errors are captured, satisfying the
"durable write failure must be observable" rule. All calls are awaited, per
`.claude/rules/post-response-work.md`, since the response promises the outcome.

### 3.5 Publication consent — `app/settings/PublicationConsent.tsx` (new)

`POST /api/evidence` already accepted `{action:"consent", enabled,
publicationAcknowledged:true, owner}`; only the UI was missing, which is why no
receipt could ever be issued. Mounted inside `EvidenceWorkflow`, which now also
reads `publicConsent` from the ledger snapshot for the initial state.

The publication consequence — withdrawal revokes access and deletes private
records, but copies already downloaded cannot be recalled — is stated **in the
control, before the user agrees**, as `policy.md` requires.

### 3.6 `/about/scoring` rewritten to v7, EN and ES

Section structure changed from 10 to 11 sections. Removed: the confidence
system and score smoothing (v7 has neither). Added: one window/one clock,
evidence-completion ranges, receipts and replay. Every dimension now publishes
its real formula and cap, taken from `SCORING_V7_POLICY`:

- `D = 100 × N(deliveryUnits, 120)`
- `Q = 25 × Σ N(criterion, 12)` over four criteria
- `C = 100 × N(activeIsoWeeks, 40)`
- `B = 50 × N(eligibleProjects, 4) + 50 × N(eligibleCategories, 4)`
- `core = (D + Q + C + B) / 4`, weights fixed at 0.25
- tiers 30 / 70 / 85, classified from the **unrounded** core
- Craft `K = 25 × Σ N(criterion, 8)`, separate, `craftDescriptorMinimum` 60

No worked-figures table was added to the page. `docs/impact-v7.md` has one that
is generated from `calculateCoreV7` and guarded by a test; a hand-copied second
table on the page would be a drift-prone duplicate of the numbers, which is the
failure this project already fixed once.

## 4. Verification performed

| Gate | Result |
| --- | --- |
| `pnpm run test` | 589 files, **9155 passed, 0 failed** |
| `pnpm run typecheck` | clean |
| `pnpm run lint` | 0 errors (7 pre-existing unused-var warnings, none from this change) |
| `pnpm run check:circular` | no circular dependency |
| `scoring-consumer-inventory.test.ts` | passes; both new modules registered |
| `dictionaries/parity.test.ts` | passes — EN/ES key sets identical |
| `dictionaries/claims.test.ts` | passes |
| Pre-commit hook | all checks passed |

New regressions added:

- `lib/profile/score-model.test.ts` — receipt preferred; labelled v6 fallback.
- `lib/profile/issue-receipt.test.ts` — issued / silent-skip / captured failure
  / no thrown error escapes.
- `lib/render/badge-view-model.test.tsx` — v6 badge unchanged with Craft axis;
  v7 range prints an interval and refuses an archetype; a straddling range
  shows no tier.

Two existing fixtures were corrected rather than worked around:
`BadgePreviewCard.render.test.tsx` and `BadgeContent.test.tsx` both built an
impact with `as unknown as ImpactV6Result` **omitting the required `handle`**.
The renderer now projects through the shared model, which identifies the
subject, so those fixtures were lying about a required field.

**Not run:** contract tests (`pnpm run test:contract:local`, needs local
Supabase), E2E, and any build. See §7.

## 5. Claims a reviewer should check hardest

### 5.1 v6 badges are byte-identical

**Confirmed by independent re-verification**, twice: 25 combinations of five v6
impacts and five option sets rendered against the pre-branch renderer and
compared by hash.

The first review round found 20 of 25 identical and five differing — every
static render carrying a translated tier label, where the accessible `<desc>`
had started printing the caller's translated tier ("Alto tier") instead of the
canonical one. That was an undeclared change to existing v6 output on the OG
and reduced-motion paths, introduced by this branch and not flagged in the
first version of this document.

It is fixed: `<desc>` now prints `score.tier`, the canonical value, while the
*visible* label stays translated. The sentence is assembled in English and
`describeScoringEvidence` continues it in English, so a translated tier read as
"Alto tier" mid-sentence regardless. A v7 range with no tier prints
"unassigned tier". `badge-view-model.test.tsx` covers both.

With that fix, v6 badge output is byte-identical to pre-branch across all 25
combinations. The mechanism behind the identity claim is unchanged:
`legacyViewModel` maps `adjustedComposite` through `point()`, whose `display`
is `Math.round`, and `computeAdjustedScore` already returns `clampScore(...)`
= `Math.round(...)` (`lib/impact/utils.ts:28`), so the projection rounds an
already-rounded integer.

### 5.2 The Craft axis rule

A v6 model keeps its pentagon; a v7 model never draws a Craft axis. If a
reviewer disagrees that Craft must vanish from the radar under v7, this is the
line to challenge — it follows from "Craft is reported beside the core and never
enters it" plus S16's "no false zero axis", but it is an interpretation.

### 5.3 Latency

`materializeProfile` gained one `readScoreReceiptV7` call — Redis first, then
Supabase — inside the existing parallel block. It should not serialize, but the
badge route has a measured p95 budget (800ms hit / 4100ms miss, #974) and this
was **not** measured. A cold Supabase read on the badge cache-miss path is the
plausible regression.

### 5.4 Scope of the fallback

Every subject without consent still gets v6. That means after this change the
public site is *still* almost entirely v6 in practice, and becomes v7 one
consenting user at a time. This is intended, but it means "the whole site uses
v7" is true of the *code path*, not yet of the *published numbers*.

## 6. Files changed

26 files, +892 / −543.

New: `lib/profile/score-model.ts`, `lib/profile/score-model.test.ts`,
`lib/profile/issue-receipt.ts`, `lib/profile/issue-receipt.test.ts`,
`app/settings/PublicationConsent.tsx`.

Modified: `lib/render/BadgeSvg.tsx`, `lib/render/theme.ts`,
`lib/profile/materialize-profile.ts`, the four render callers, the three write
routes, the warm-cache cron, `app/settings/EvidenceWorkflow.tsx`,
`ScoringMethodologyContent.tsx`, both dictionaries, `docs/scoring-consumer-inventory.md`,
and five test files.

## 7. Not done — the gaps a validator should treat as open

1. **S18 pilot not run.** The empirical validation `policy.md` names a relaunch
   blocker has not happened. This change ships v7 rendering ahead of it, by
   explicit user decision.
2. **S19 not executed.** No cache-namespace transition, no
   `scripts/scoring/migrate-v7.ts`, no `docs/runbooks/scoring-v7-transition.md`,
   no badge render-variant coordination. A v6→v7 transition for an existing
   subject will change their published number with no migration rehearsal and
   no old/new reason recorded.
3. **Copy is only partly migrated.** `/about/scoring` is done in both locales.
   Still describing v6 or mixing versions: `llms.txt`, `llms-full.txt`, the
   seven `/archetypes/*` pages, landing copy, share-page and dashboard
   explanation strings, `about.index`, `dashboard.confidence.*`, and the email
   templates. Grep starting points: `confidence`, `recency`, `adjusted`,
   `smoothing`, `stars|forks|watchers` in both dictionaries.
4. **No visual check.** No build, no browser, no rasterized OG. The 30px
   five-character headline, the "evidence range" and "insufficient evidence"
   labels, and the diamond radar have never been *seen* — only asserted in
   string tests. The OG path additionally rasterizes through resvg, where a
   font/width problem would not show up in any test run here.
5. **No contract tests.** `score-receipt-v7.contract.test.ts` and the evidence
   ledger contract suites need local Supabase and were not run.
6. **Consent UI is untested.** `PublicationConsent.tsx` has no test file. It is
   also not registered in the consumer inventory (it reads no score, so the
   scanner does not require it, but a reviewer may disagree).
7. **The claims gate still does not check arithmetic.** The defect that let
   S17 pass with v6 formulas intact is unfixed. A test asserting published caps
   and weights against `SCORING_V7_POLICY` would close it and is the single
   highest-value follow-up.
8. **Not pushed, no PR, not deployed.** Branch is local only.

## 8. Suggested validation order

1. Re-run the four gates independently (`test`, `typecheck`, `lint`,
   `check:circular`).
2. Verify §5.1 by rendering one badge from a real v6 profile before and after
   and diffing the SVG strings.
3. Build and look at a v7 badge with a ranged fixture — the largest untested
   surface.
4. Read `policy.md` §"Fixed composite, ranges and labels" against the new
   `/about/scoring` copy, EN and ES, for arithmetic accuracy.
5. Decide whether §7.1/§7.2 are acceptable, or whether this should sit behind a
   flag until S18 and S19 complete.

---

## 9. Independent review outcome, and the flag

An independent agent reviewed this branch and returned **not ready for
production**. The verdict was correct, and §3–§7 above under-stated the
problem: the handoff described the cutover as complete when it reached one
surface.

### 9.1 Confirmed findings

All verified at the cited lines.

| # | Finding | Status |
| --- | --- | --- |
| 1 | Share page header (`page.tsx:435`), JSON-LD description (`:373`) and the owner dashboard/breakdown/explanation panel all read the v6 impact while the badge above them draws v7 | **Open** |
| 0 | No migration seeds a `scoring_v7_rendering` row, and `dbUpdateFeatureFlag` is an UPDATE rather than an upsert, so the /admin toggle matches nothing and the flag could only be flipped by a Vercel env change plus a redeploy | **Fixed** — migration `049` |
| 2 | Every caller passed `stringsFor(displayImpact.tier)`, and the renderer preferred that label whenever the v7 tier was non-null, so a v7 core printed a v6 tier word; the two v7-only labels were supplied by nobody and fell back to English in Spanish | **Fixed** — `dea4eb54` |
| 3 | The verification HMAC is still generated from `displayImpact` (`public-profile.ts:66`), so a v7 badge's strip resolves to a record carrying v6 numbers | **Open** |
| 4 | `getLeaderboard` reads `displayImpact.adjustedComposite` (`leaderboard.ts:75`) and `headline_score` is the v6 headline, so board and badge disagree; the public API's `displayScore` has the same problem | **Open** |
| 5 | `BadgePreviewCard.tsx:64` renders without `scoring`, so an owner customizes a v6 preview of a badge that publishes as v7 | **Open** |
| 6 | `getCachedReceiptSnapshotV7` hits the Supabase manifest RPC before Redis, and a null result costs a second RPC — on every badge cache miss, for handles that are almost all unconsented | **Open** (mitigated: the flag skips the read entirely while off) |
| 7 | The cron renders from the receipt read at materialization and issues afterwards, so the cached badge lags one issuance; worse, `materializeScoreReceiptV7` always mints `revision: 1` with no supersedes link, so an hourly cron would produce ~24 unchained receipts per consented user per day, each with a fresh verification token | **Open** (mitigated: the flag blocks issuance) |
| 8 | Granting consent issues nothing; settings says publication is on while the badge stays v6 until the next refresh or warm-cache pass | **Open** |

Findings 1, 3, 4 and 5 are one defect repeated: the same revision publishing
two numbers, which is precisely what `score-model.ts`'s own comment says the
resolver exists to prevent.

The reviewer also found that v6 byte-identity (§5.1) holds for 20 of 25
rendered combinations. The five that differ are static renders with a
translated tier: the accessible `<desc>` now prints the caller's translated
label instead of the raw English tier. That was my change and I did not flag
it. It is the same caller-supplied label as finding 2 and is now resolved from
the drawn model.

One reviewer claim did not reproduce here but was later pinned down on their
side: a single full-suite failure in the Studio `beforeunload` guard, which
passes in isolation. Both machines agree it is a timing flake under full-suite
load rather than a defect in this branch. It needs its own issue, because a
test that fails on full-suite timing will eventually fail in CI on an unrelated
PR.

### 9.2 The flag

`scoring_v7_rendering` — DB-backed via `checkFlag`, env fallback
`SCORING_V7_RENDERING_ENABLED`, **off by default**, server-only.

It gates **both** halves deliberately:

- `readRenderableReceipt` returns `null` while off, so `materializeProfile`
  never reads a receipt. Finding 6's cost does not arise, because the read
  does not happen.
- `issueScoreReceiptIfConsented` returns `"skipped"` before calling the
  materializer, so nothing durable is minted. Finding 7's unchained hourly
  receipts cannot occur.

With it off, every surface shows the same v6 aggregate it always did, and the
branch is inert apart from the `/about/scoring` copy, which is correct v7
documentation of the policy the code implements.

### 9.3 Conditions for turning it on

Do not enable until all of these hold:

0. **Done** — `supabase/migrations/049_seed_scoring_v7_rendering_flag.sql` seeds
   the row disabled, so the flag can be flipped from /admin and, more
   importantly, flipped back without a deploy. Nothing below could be exercised
   in production without it.
1. Findings 1, 3, 4, 5 closed — share header, JSON-LD, verification HMAC,
   leaderboard, public API headline and Studio preview all read
   `ScoreViewModel`.
2. Finding 7 closed — receipts form a revision chain (`supersedesRevisionId`,
   incrementing `revision`) instead of minting a new root per pass, and the
   cron issues before it renders.
3. Finding 8 closed — granting consent issues a receipt synchronously, so the
   settings state and the badge agree immediately.
4. Finding 6 addressed — Redis before Supabase, and one RPC rather than two on
   a miss.
5. A v7 badge has actually been looked at: a ranged fixture rendered, the
   five-character headline rasterized through the OG path, and the badge
   latency budget re-measured with the receipt read enabled.
6. The S18 pilot and the S19 migration rehearsal resolved, or an explicit
   decision to proceed without them.

This is the RPI scope. It should be planned as phases, not grown further on
this branch.

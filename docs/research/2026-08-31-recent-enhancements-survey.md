# Research: Recent Enhancements Survey (v2.26.0 → v2.27.0)

**Date:** 2026-08-31
**Branch:** `develop` @ `48206b13`
**Question:** What are the latest enhancements in the codebase?

This document describes what IS in the code as of HEAD. Five parallel research agents
covered the design system, Creator Studio + badge, scoring integrity, the release
pipeline, and recent feature additions.

---

## 0. Orientation: what shipped, when

`apps/web/package.json` is at version `2.27.0`. Three releases landed in the last two days
of August 2026, and `CHANGELOG.md:8` shows `[Unreleased]` currently empty.

| Release | Date | Headline |
|---|---|---|
| `[2.26.0]` `CHANGELOG.md:83-157` | 2026-08-30 | Jade palette, one-badge-artifact, `/settings`, `light-dark()` token layer |
| `[2.26.1]` `CHANGELOG.md:61-81` | 2026-08-30 | Merge-commit release promotion; brand assets recolored |
| `[2.27.0]` `CHANGELOG.md:10-59` | 2026-08-31 | Color Palette (7th badge category), Studio horizontal split, user-registration fixes |

Six work streams account for nearly all of it: a brand recolor, a token-architecture
rewrite, a badge/Studio consolidation, a scoring-seam documentation pass, a release-pipeline
rewrite, and a set of feature additions (`/settings`, WebMCP, locale-segmented RSC).

---

## 1. Design system: violet → Jade, and the `light-dark()` token layer

### 1.1 The recolor (#1206)

`bbd6100e` (2026-08-29) replaced the violet palette with Jade green across 60 files
(+1073/-359). It was color-only — fonts, type scale, spacing, radii, shadow geometry and
every component API were untouched. The accent is now hue 163:

| Token | `globals.css` | Light | Dark |
|---|---|---|---|
| `--color-amber` | `:55` | `oklch(.66 .15 163)` | `oklch(.76 .16 163)` |
| `--color-bg` | `:25` | `#f7fbf8` | `#08170f` |
| `--color-card` | `:26` | `#edf6f0` | `#0f2419` |
| `--color-text-primary` | `:43` | `#0b2018` | `#dfeae4` |
| `--color-complement` | `:77` | `oklch(.55 .1 225)` | `oklch(.7 .11 225)` |

The token name `--color-amber` is deliberately historical — `apps/web/styles/globals.css:52-54`
records that renaming it "touches every consuming utility class, so it stayed."

Two secondary color decisions are documented in the same file: success is hue **145**, not the
accent's 163, because "with a green brand accent, an unshifted success color reads as a brand
highlight" (`globals.css:66-67`); and the verification family moved from teal to **slate blue**
(hue 225–228) so cryptographic trust reads as distinct from the brand (`globals.css:72-76`).

A follow-up commit `e58d7cf6` fixed the doc: the palette PR had left `design-system.md`
internally inconsistent, with 15 token rows still on old values. Those rows are now
**generated from `globals.css`** so they cannot drift again.

### 1.2 Text-safe accent tokens

`--color-amber` is a **fill/tint value** measuring 2.75:1 on the light ground — below AA at any
size. `60a409e6` (#1243) introduced `--color-amber-text` at `globals.css:64` as its text-safe
counterpart: `light-dark(oklch(.5 .12 165), oklch(.84 .14 163))`, measuring 5.28:1 light and
11.94:1 dark. This is the same shape as the pre-existing `--color-complement-text` (`:83`).

**Rule:** accent-colored text and icon strokes use `text-amber-text`; `text-amber` is for
fills and tints only.

### 1.3 The `light-dark()` rewrite (#1211/#1212)

`1b0198f2` (2026-08-29) is the architectural change. ADR:
`docs/decisions/2026-08-29-light-dark-token-layer.md`.

Previously every themed color was written **twice** — once in `:root`, once in
`[data-theme="dark"]`. Three tokens had already drifted because of that duplication. Now each
token is one declaration inside `@theme`:

```css
--color-bg: light-dark(#f7fbf8, #08170f);
```

`color-scheme` decides which half resolves (`globals.css:147-161`):

```css
:root                { color-scheme: light dark; }  /* follow the OS */
[data-theme="light"] { color-scheme: light; }
[data-theme="dark"]  { color-scheme: dark; }
```

`data-theme` now carries **only** `color-scheme`. Native form controls, scrollbars and focus
rings follow the theme for free.

**No `@supports` fallback is wanted**, and this was verified against build output rather than
assumed. The ADR (`:36-62`) quotes the compiled CSS: LightningCSS lowers `light-dark()` to a
custom-property toggle keyed off the same `color-scheme` selectors, so all three modes work
below the native browser floor (Chrome/Edge 123+, Safari 17.5+, Firefox 120+).

Enforcement is in tests: `apps/web/styles/tokens.test.ts:65-71` asserts every token is declared
once with `light-dark(`, and `apps/web/lib/test-helpers/css-tokens.ts:38-53` throws if a
`light-dark()` doesn't have two arguments.

### 1.4 Three-mode theme control

`apps/web/components/ThemeProvider.tsx:22` sets `attribute="data-theme"`,
`defaultTheme="system"`, `enableSystem`. The comment at `:14-20` notes `enableSystem` alone is
insufficient — next-themes only consults `prefers-color-scheme` on a first visit when
`defaultTheme` is itself `"system"`.

`ThemeToggle.tsx` is one button cycling `["system", "light", "dark"]` (`:11`), with three
stacked icons (monitor / sun / moon, `:47-99`). Its `aria-label` names **the mode the next
press selects**, not the current state (`:14-18`), "so a screen-reader user hears the outcome."

### 1.5 The always-dark forest family

`--color-forest-*` (`globals.css:92-108`) are nine tokens with **one value in both themes** —
deliberately not `light-dark()`. They exist because some surfaces frame a server-rendered dark
artifact and must not follow the theme.

A subtlety worth knowing: the **hero band is NOT one of them**. `#1215` moved it to the
theme-aware `--color-hero-band` (`globals.css:33`) because "an always-dark hero made light mode
a strip around a dark slab." Only the **badge panel and CLI blocks** stay dark —
`LandingContent.tsx:400-415` and `StudioClient.tsx:729`.

The forest family carries its own status colors (`--color-forest-ok/-warn/-err`, `:106-108`)
because theme-aware status colors resolve to their *light* values on a light page, measuring
3.72:1 and 3.19:1 on the forest ground — below AA (`globals.css:102-105`).

> **Doc drift found:** the `--color-forest-*` header comments in both `globals.css:92-95` and
> `design-system.md:52` still say the family covers "the hero band, badge panel and CLI blocks."
> `design-system.md:89` and `globals.css:30-32` correct this. The headers are stale on that point.

### 1.6 The badge stays fixed-dark

`apps/web/lib/render/theme.ts:26-33` states the constraint: the badge SVG renders server-side
**before app CSS exists**, so it cannot read a CSS custom property. Every palette is resolved
to literals. They are **hex, not `oklch()`**, "because the OG-image route rasterizes this SVG
through resvg, which parses a narrower colour syntax than a browser."

`dcb495f9` (#1225) converged the badge onto Jade, taking the **dark half** of each app token
(`oklch(.76 .16 163)` → `#1BD093`). The commit notes the violet "was NOT confined to
`theme.ts`. It was spelled out as 28 literals across six files, which is exactly how it
survived the #1206 rebrand." Accent contrast went from the violet's 4.58:1 to **9.68:1**.

The badge **ground did not move** — `#0C0D14` / `#13141E` remain "a cooler canvas tuned for the
badge." `apps/web/lib/render/theme.test.ts:92-120` pins this divergence from the app tokens on
both sides so an unintended change to either fails.

`c0605a54` (#1229) finished the job on six **served brand assets** that had kept the retired
violet — the visible symptom was a violet shield in the browser tab, because `layout.tsx`
declares `icons.icon = /favicon.svg`, overriding the Next file convention.

---

## 2. One badge artifact: Studio and the embeddable SVG converged

ADR: `docs/decisions/2026-08-30-one-badge-artifact.md`.

### 2.1 What was wrong

`BadgeContent` was a **405-line React DOM reimplementation** of the badge interior — its own
heatmap, radar chart, tier treatment, stat cards and footer, each maintained in parallel with
`renderBadgeSvg`'s. Studio previewed the DOM version; users embedded the SVG version.

### 2.2 What replaced it

`6fa9cf96` retired it. `renderBadgeSvg` (`apps/web/lib/render/BadgeSvg.tsx:84`) is now the
single implementation, and it consumes `BadgeConfig`:

- `BadgeOptions.config` is **passed in, not read from a store** (`BadgeSvg.tsx:61-64`) — "that
  purity is what makes the SVG cacheable per handle/day/locale and rasterizable to PNG."
- Omitting it renders **byte-identically** to the pre-#1191 badge, so no cached badge or
  embedded README image moves (`:57-65`).
- `BadgeContent.tsx` is now a 59-line wrapper used only by flag-gated `/experiments/*`
  prototypes. `apps/web/lib/badge-visual-metadata.test.ts:85` asserts no line matches
  `/\bBadgeContent\b/`, pinning the dependency direction.

Studio's preview is now the real SVG: `apps/web/app/studio/BadgePreviewCard.tsx:61-72` calls
`renderBadgeSvg` directly. One resolver, `resolveBadgeConfig` (`lib/render/badge-config.ts:25-32`),
feeds **four** render sites — share page, OG image, badge route, warm-cache cron — because they
all write to the same `buildBadgeSvgCacheKey` slot.

### 2.3 Nine categories became six, then seven

`BadgeConfig` (`packages/shared/src/types.ts:288-296`) has exactly seven fields. Three were
**dropped from the schema** (`06011154`) rather than labelled, because an SVG "cannot express a
pointer, a scroll position, or a JavaScript loop":

- `interaction` (3D tilt needs a pointer)
- `statsDisplay` (counting animation needs a JS loop)
- `celebration` (an "on load" burst is meaningless for a cached image)

Notably, step 4 had shipped a "preview only" pill for these, and **step 5 reversed it**
(ADR `:60-74`): labelling them taught, control by control, "that the preview is not the
artifact, which is corrosive precisely because the other six had just stopped being a
lookalike."

`cardStyle` is the documented **partial** crossing (`badge-effects.ts:296-317`): Studio's glass
looks are `backdrop-filter`, which composites against what's behind the element, and "SVG has
no equivalent — `feGaussianBlur` blurs the source graphic, and the badge is an opaque plate
with nothing behind it."

Dropping a field is a **migration, not a rename** (ADR `:158-165`): `isValidBadgeConfig` requires
an exact key set, so a stored nine-key row would read back as invalid and hand the owner the
default — a durable write silently discarded. Three read-path migrations now compose in
`lib/db/studio.ts:182-183`:

```
withDefaultBadgeConfigKeys(renameLegacyBadgeConfigKeys(stripRetiredBadgeConfigKeys(row.config)))
```

`RETIRED_BADGE_CONFIG_KEYS` (`types.ts:307-311`) ends with: "Never reuse one of these names for
a new category."

### 2.4 Color Palette, the seventh category (#1242/#1245)

Five palettes — `jade | indigo | amber | crimson | mono` (`types.ts:274`). Each carries an
accent ramp **and its own ground**, so an option reads as "accent on ground."

The design mock approximated this with a CSS filter over the preview image. **That route was
closed by #1191** — a filter over the real SVG "would recreate exactly the preview-vs-artifact
divergence that ADR closed." So the palette resolves *in the renderer*: `WARM_AMBER`,
`accentTint`, `getHeatmapColor` and `getTierColor` stopped being module-level singletons and
became functions of a resolved theme.

Three boundaries the palette does not cross (`theme.ts:69-77`):
- **Archetype hues stay fixed** — one hue per archetype is a semantic signal.
- **`VERIFICATION_CORAL` (#E05A47) is untouched** — hence `crimson` ships as a *rose*; a coral
  accent sat 2.4° from the verification coral and "would have collapsed that distinction."
- **App chrome stays jade.**

`jade` holds the exact shipped values, so the default badge renders byte-for-byte unchanged and
no `BADGE_RENDER_VARIANT` bump was due (currently `"jade-v1"`, `badge-svg-cache.ts:21`).

The handoff spec was **measured, not adopted literally** (`theme.ts:50-68`) — three rejections:
its "current badge" jade triple was actually the *app's* forest palette; its grounds sat
lighter (oklch L .19–.23 vs this family's .1615), putting Quality Champion at 4.36:1; and its
crimson sat 13.7° from the verification coral. What was adopted were the **hues, re-derived at
the measured-safe lightness**.

`BadgeConfig.palette` → `colorPalette` (`61854bf6`): "Nothing outside dev has persisted one, so
the rename is free now and costly later." The `/set palette <id>` alias is unchanged
(`command-registry.ts:56-64`).

### 2.5 Studio layout

`dac2c3f6` (#1241) rebalanced to a **horizontal split**: the badge is a fixed 1200×630 artifact,
"so a 50% column could never let it grow." The badge now gets a full-width stage with
Fit/50%/100% zoom (`StudioClient.tsx:681-705`), and the tools band below splits on **its own
width** via `@container`, not a viewport breakpoint (`:786-788`). `/save` and `/reset` moved out
of the collapsible panel — "collapsing the controls took the only pointer route to saving with
it."

`60a409e6` (#1243) brought Quick Controls to the v3 design: the `max-h-64` category cap removed
(correct in #1216's narrow column, wrong in a full-height one), presets got a real selected
state via an equality check (`QuickControls.tsx:39-43` — "A preset sets every category, so
'applied' is an equality check, not a fuzzy match"), rows went 34px → 52px with a chevron, and
options became wrapping 44px chips.

Two contrast findings were made **in a real browser**, not in review: the Spanish stage-meta
string overflowed a 390px viewport into horizontal scroll, and `text-amber` at 11px measures
~2.8:1 on the light ground — which is what motivated `--color-amber-text` (§1.2).

> **Minor drift:** `QuickControls.tsx:25-33` and `studio-config-string.ts:9` still say "six"
> categories; `STUDIO_CATEGORIES` now holds seven.

### 2.6 `/api/studio/config`

`apps/web/app/api/studio/config/route.ts` — feature-flag gate first (404), then session
(401). Read path is **Supabase directly, no Redis** (`:41-44`). The PUT strips retired keys
*before* validating, so "a Studio tab loaded before the three preview-only categories were
dropped" doesn't get a 400 (`:103-106`), rate-limits at 30/hour, writes the **validated** value
rather than the raw body, and fires `invalidateBadgeSvgCacheForHandle` — because "the badge
cache key carries handle/variant/date/locale but nothing about the config, so a save has to say
explicitly that the rendered badge is now wrong" (`:147-151`).

---

## 3. Scoring: the integrity contract and the flag-combination table

### 3.1 The contract (#1060/#1061)

ADR: `docs/decisions/2026-08-11-scoring-data-integrity-contract.md`. The invariant (`:56-59`):

> The integrity guards operate exclusively on GitHub-derived stats. Linked-platform and EMU
> supplemental data are composed onto whichever GitHub-derived value the guards select — never
> before them, and never into the protected baseline.

Two keys express it: `stats:stale:v2:<handle>` holds **GitHub-derived data only** (the guards'
comparison baseline; versioned to v2 because pre-#1060 entries held composed data), and
`stats:v2:merged:<handle>` holds the **composed** value callers receive.

The ADR is candid about how the bug arose (`:31-34`): the supplemental merge shipped in April,
the guards arrived in July, and "nobody decided that composed data should be the guard input —
it simply already was." Two defects followed, and **neither was reachable by the test suite**
(`:50-52`): "every guard test declared supplemental null, every supplemental test declared the
baseline null, and no test combined them."

Three enforcement boundaries:

| Boundary | Function | Location |
|---|---|---|
| Fetch | `assessRawFetchIntegrity` — 4 rejection reasons | `lib/github/stats-integrity.ts:145-184` |
| Cache | `isDegradedPrFetch` + non-downgrading scope write | `lib/github/client.ts:543`, `:574-581` |
| Persist | `guardStatsComplete` on **both** snapshot writers | `lib/profile/persist-guard.ts:14-30` |

The structure encodes the ordering: `_fetchAndCache` resolves baseline/primary/overlays in one
`Promise.all` (`client.ts:510-514`), the guards close over **primary and baseline only**, and
`_compose` runs strictly after at `:588`. The comment at `client.ts:191-212` states the rule for
future work: "a future fourth data source belongs in `_compose`, never in the guard input."

`fe192491` (#1193) hardened this further — `_compose`'s three identity fields are assigned once
at the end from the original GitHub-derived value (`client.ts:445-455`) rather than surviving
the merge fold, making them order-independent **by construction**.

### 3.2 The root cause it traces back to

`docs/research/2026-07-07-scoring-data-corruption-root-cause.md:13` names the class: a fetch can
return **structurally-valid-but-degraded** data, and nothing validated completeness before it was
cached to both keys, scored, persisted to permanent history, and baked into the HMAC record.

The signal existed and was discarded: `pullRequestContributions.totalCount` is read into the raw
payload but `buildStatsFromRaw` derived every PR metric from `nodes` alone, so
`{ totalCount: 143, nodes: [] }` became `prsMergedCount: 0` silently. Exactly **one** unsafe
shape exists — a well-formed object with an empty array, because `[].filter()` doesn't throw
while a null intermediate does (`:45-59`).

Live evidence for `juan294` (`:88-95`): cached stats held `prsMergedCount: 0` alongside
`commitsTotal: 15585` — "private-inclusive everywhere except PRs = 0" — against a ground truth
of 904 merged PRs. Because `stats:stale` was already poisoned, the guard's zero-baseline
short-circuit meant it **could not self-heal**.

The doc also records that the same bug class had recurred since 2026-03-08, and that a
2026-03-31 plan "predicted this exact failure and accepted it as a bounded risk" (`:126`).

### 3.3 The flag-combination table (#1192)

`63d185d2` added `docs/decisions/2026-08-30-scoring-cache-seam-flag-combinations.md`. The
motivation was measured issue density on one seam: **15 issues across three files**, several
correcting a previous fix (#1050 corrected #1002's direction; #1060/#1061 corrected #1004's
composition order).

Seven flags thread through `materializeProfile` / `getStats`: `readOnly`, `inputsChanged`,
`ignoreSnapshot`, `policy`, `today`, plus the **derived** `statsComplete` and `fetchScope`. The
table gives each one's effect on five columns: cache keys read, cache keys written, live fetch,
snapshot persistence, verification minting.

The three combinations that "actually bite" (`:42-59`):

1. **`readOnly` + cold key** — before #1083 this triggered a live GitHub fetch on every public
   read of an uncached handle. Now returns baseline or null, and "a caller that treats null as
   'no profile' rather than 'not cached' will show an empty page for a real user."
2. **`inputsChanged` + the same-day lock** — must set **both** the EMA bypass and the UPSERT
   path; "setting only one leaves the fresh score computed and then discarded on the UNIQUE
   conflict."
3. **`fetchScope` + composition order** — "`_compose` runs after the guards, never before."

The ADR deliberately adds **no property tests and no CI gate** (`:61-65`): "the value here is
comprehension; the enforcement already exists as the integrity guards themselves." It also
*replaced* three CLAUDE.md bullets rather than adding a fourth, with the maintenance rule: "A
new flag on this seam belongs in the table above, in the same commit that adds it."

### 3.4 Supplemental flow

`_loadSupplemental` (`client.ts:276-292`) reads Redis, falls back to
`dbGetSupplemental`, and rehydrates Redis fire-and-forget on a DB hit. It runs concurrently with
the three linked-platform fetches, which in turn run concurrently with the GitHub fetch and the
baseline read — safe precisely because every guard closes over primary and baseline only.

The `stats:dirty:<handle>` marker (`lib/cache/dirty-stats.ts`, 1h TTL) is set by the CLI upload
route, read by `materializeProfile`, bypasses the same-day EMA lock, routes the write through
`dbReplaceSnapshot` (UPSERT), and is cleared after a successful persist. The upload route's
comment (`supplemental/route.ts:120-123`) notes `stats: true` invalidation is load-bearing —
"Without it the upload succeeds and the score silently never moves" — and that
`stats:stale:v2:` is deliberately **not** cleared, per the contract.

### 3.5 Test coverage of the invariants

`client.integrity.contract.test.ts` runs the **real pipeline** with only `fetch` mocked, against
a redis fake and a real local Supabase. Its #1060 test asserts the exact arithmetic: a rejected
fetch re-composes to `prsMergedCount === 936` (904 protected baseline + 32 supplemental) while
the baseline stays at 904 without `hasSupplementalData`.

`stats-integrity.test.ts` pins the **actual production payloads** — the juan294 2026-07-14
blinded payload against the healthy 07-13 one — and asserts the blindness threshold sits
strictly below the provable per-node weight floor.

---

## 4. Release pipeline: direct proof, and the squash tax

### 4.1 Direct proof

Plan: `docs/plans/2026-08-29-direct-proof-release-pipeline.md:10` — "Replace Chapa's
proof-of-proof release path with a small default release transaction that proves the candidate,
deployment, rollback, migration, and publication facts **directly**."

The scale of the simplification is in the commits: `aeffd141` replaced the evidence-graph
workflow with one direct Preview proof job (238 insertions, **1279 deletions**), and `55e2a115`
deleted the retired implementation — 31 files, **6823 deletions**, including a 1399-line
`contracts.ts`, five JSON schemas and six fixtures.

What remains is small and typed: `scripts/quality/release-result.ts` (a compact JSON receipt
with hand-written assertions, no JSON schema), `validate-release-docs.ts` (the docs contract),
`verify-deployment-identity.ts`, and one executable authority for scenario selection —
`apps/web/e2e/helpers/release-required-environments.ts:54`, which yields 5 scenarios for preview
and 4 for production by default.

Two deviation notes are worth keeping (`...-notes.md`): the plan's "one wave" pseudocode read
literally as `&` + `wait "$pid"`, which is "exactly the 'shell backgrounding that hides exit
codes' the same phase explicitly forbids"; and the bounded local sequence was **timed** at ~30
seconds against a 5-minute target.

A fail-closed gate now guards release PRs: `.github/workflows/ci.yml:549-555` — "if either
credential is missing, the job fails closed instead of silently reporting a skipped pass — a
missing production read credential is itself the release-blocking condition."

### 4.2 The squash-release tax

`docs/squash-vs-merge-release-topology.md` (added by `3874ac2a`) is written to be **portable to
other repos**, and opens with "Evaluate it, do not apply it blindly."

The mechanism (`:14-31`): a squash creates a commit on `main` whose *content* matches `develop`
but whose parents don't include the released `develop` commit. Four compounding consequences:
the release PR eventually goes `CONFLICTING` → GitHub never creates `refs/pull/N/merge` → no
`pull_request` event fires → **every `pull_request` check reports `skipped`, not `failed`**.

> "Step 4 is the dangerous one. A gate that reports `skipped` looks fine on a dashboard. In
> chapa this nearly let a database migration ship behind a migrations gate that never ran."

That's not hypothetical — migration `037` shipped in v2.26.0 (`CHANGELOG.md:156-157`), and
`d4eb9abb`'s message states "v2.26.0 nearly shipped migration 037 behind that inert gate."

A survey of 30 repos (`:65-83`) found **every** squash-only develop+main project carried
hand-made back-merges: chapa 40, portfolio 36, archy 33, paisaxe 18, coach 10. The two repos
promoting with a merge commit had none.

The sequence of three commits shows the reasoning changing:

- `611e8df5` **kept** the back-merge and made its failure loud, documenting the measured cause:
  `develop` has classic branch protection with six required contexts, so `github-actions[bot]`
  is declined with GH006 when pushing "a brand-new merge commit that by definition has no check
  results." It states plainly: "This does NOT fix the permission. It cannot be fixed from
  inside the repo."
- `d4eb9abb` **deleted** it — "Squashing was the root cause, not the back-merge's absence." A
  merge commit preserves ancestry by construction, "so there is nothing to automate, no
  protected-branch push, and no token." Net: 46 insertions, 283 deletions.
- `db0cd5e7` **corrected** the preflight: the ancestry assertion was replaced with a prospective
  **tree** proof (`release-playbook.md:27-33`), because branch divergence after a merge
  promotion is expected.

The generalized warning (`:110-123`) is the most transferable part:

> chapa was not unusual in having this problem. It was unusual in **automating** the workaround
> — and the automation silently failed for two releases because its CI token could not push to
> a protected branch. A comment in the workflow asserted it could not be blocked, so nobody
> investigated. **Broken automation was worse than no automation.**
>
> If you are about to add a token, a bypass actor, or a ruleset exception to make a back-merge
> work — check whether you need the back-merge at all first.

Before making the trade, the tree-identity proof was **verified rather than assumed**: merging
`develop` into `main` produced a tree byte-identical to `develop`'s, so the playbook's
`mainTreeDigest == candidateTreeDigest` proof is unaffected, and `git log --first-parent main`
still shows one line per release — "which is all the squash was buying."

The contract is now inverted in code: `validate-release-docs.ts:246-250` **rejects**
`gh pr merge --squash` across the release docs, so the drift cannot be reintroduced silently.

### 4.3 The vercel.json outage (#1052)

ADR: `docs/decisions/2026-07-16-vercel-json-must-live-in-root-directory.md`. The Vercel project's
Root Directory is `apps/web`, and **Vercel resolves `vercel.json` relative to that**, not the
repo root. The file lived at the repo root and "was therefore never read — for the entire life
of the project."

> Nothing failed. There is no error, warning, or log line for configuration that is simply
> never loaded. The file looked correct in review, was version-controlled, and was edited
> several times by people who believed it was live.

All four crons — `warm-cache`, `sync-audience`, `process-campaigns`, `latency-check` — never ran
once in ~5 months. Confirmation was behavioral: `/api/health` reported `lastRun: null` for all
four, and the Vercel dashboard showed the "Get Started with Cron Jobs" onboarding screen, which
only renders for a project with **zero** registered crons.

Downstream damage (`:42-53`): #1045's cache poisoning survived three days because warm-cache is
what re-fetches with the `repo`-scoped server token — "The self-healing mechanism the caching
design depends on did not exist in production." The badge latency SLO monitor "never ran… dead
code in production from the day it shipped." And several commits that adjusted cron schedules
"changed nothing."

Monitoring missed it for a subtle reason (`:55-61`): the health endpoint's grace window was
measured from a module-load timestamp, and "on serverless every cold start reloads the module,
so that window could never elapse and the null branch reported `stale: false` permanently. **The
one state that mattered was the one state it could not report.**"

The guard added is a **location** assertion, not a behavior one:
`scripts/check-vercel-config.ts` pins `VERCEL_ROOT_DIRECTORY = "apps/web"` and runs in CI. Its
lesson (`ADR :100-105`):

> Configuration that is never read fails silently and looks correct forever. Guards that assert
> *behavior* cannot catch it — only a guard that asserts *location* can. The general form: when
> a file's effect depends on where it sits relative to a setting stored in another system, pin
> that setting in the repo and test the relationship.

---

## 5. Feature additions

### 5.1 `/settings` (#1223)

`apps/web/app/settings/` — session-gated with the inline per-page pattern of the no-middleware
ADR (`page.tsx:26-29`), `robots: noindex` because "Account pages have nothing to offer a crawler
and everything to leak" (`:21`).

Three sections, each styled as a terminal command: **Identity** (`chapa whoami`),
**Connections** (`chapa connections` — Bitbucket, Codeberg, GitLab; GitHub is the session
identity), **AI insights** (`chapa insights`, flag-gated).

The logic was **extracted from `UserMenu`, not copied** —
`lib/platform/use-platform-connections.ts` (whose header records it "used to live inside
`UserMenu`, as three near-identical state triples and three near-identical unlink handlers") and
`lib/insights/use-insights-import.ts`. Account deletion is explicitly out of scope; it exists
only as `scripts/delete-user.ts`.

### 5.2 Profile dropdown trimmed (#1238)

`3a5b08da` cut `UserMenu.tsx` from 720 to 232 lines (and −3757 lines of tests). Everything
removed already existed on `/settings`. The dropdown is now navigation only: My Badge, Creator
Studio, Settings, Admin, Sign out.

The trim surfaced an **a11y defect**: auditing orphaned dictionary keys revealed that #1223 had
moved the flows without their aria labels — all three unlink buttons on `/settings` announced as
plain "Unlink," and the file input had no accessible name. Fixed in the same commit
(`SettingsClient.tsx:62-66`, `:242`, `:285`).

### 5.3 Locale-segmented RSC pages

Two ADRs govern this: `2026-07-08-no-middleware-adr.md` and its
`2026-07-15-i18n-middleware-carve-out.md` addendum. The carve-out executes the original ADR's own
escape clause rather than contradicting it.

`apps/web/proxy.ts` (Next.js 16 renamed the `middleware.ts` convention) does a **rewrite, never a
redirect**, with a matcher of exactly **13 literal paths, no wildcards** (`:67-83`). It
re-implements locale resolution rather than importing `getServerLocale()` because it runs on the
Edge runtime and must not import `next/headers` (`:6-16`).

The root layout stays static and pins `DEFAULT_LOCALE` (`layout.tsx:114-120`) — calling
`cookies()`/`headers()` there would force every page dynamic. `<html lang>` is corrected
client-side by `DocumentLocaleMarker`.

`9ba966f3` (#1194) then **derived** the boundary instead of choosing it:
`DynamicRouteShell.tsx` renders the locale marker, the `LanguageProvider` and the Navbar
together. `/studio`, `/admin` and `/settings` "were still missing both locale corrections when
this component was written — they rendered in `DEFAULT_LOCALE` for every visitor," and
`/verify/[hash]` had a third hand-rolled copy. `DynamicRouteShell.boundary.test.ts` enforces
both directions: no `app/[locale]/` file may import it, and all five dynamic routes must.

### 5.4 WebMCP — shipped, flag-gated

This is **implemented, not research-only**. The runtime spike passed
(`docs/research/2026-08-27-webmcp-runtime-spike.md:8-11`), a polyfill was a NO-GO, and the plan's
six phases are checked complete.

**15 distinct tool names across 3 surfaces**: Studio (9, incl. a shared
`explain_dimension`), share page (4), verify page (2). Core hook:
`lib/webmcp/use-model-context-tools.ts`, which feature-detects `"modelContext" in document` and
registers under a single effect-scoped `AbortController`.

Two design decisions stand out:

- **Saving is human-gated.** `save_badge_config` calls `proposeSave()` and returns "Save
  proposed — the user must confirm on-page" (`useStudioWebMcpTools.ts:254-261`). It never calls
  the PUT; `handleAgentSaveConfirm` is the only path to `handleSave()`.
- **Agent actions route through the visible terminal.** `apply_badge_style` passes
  `runCommand: handleSubmit`, so it executes the same `/set` command a human types.

Free text crossing the tool boundary is sanitized (`shared-tools.ts:48-58`), with the scope
explicitly bounded: "a projection for the WebMCP tool boundary ONLY. It must never be applied to
the SVG render path or the share-page HTML render path."

Both flags (`webmcp_enabled`, `studio_demo_enabled`) default to **false**
(`supabase/migrations/036_seed_webmcp_flags.sql`). `docs/webmcp.md:7` notes the catalog "still
needs final production verification after release and flag enablement."

### 5.5 PostHog slim build (#1197)

`PostHogProvider.tsx:24` imports `posthog-js/dist/module.slim.js`. The default entry pulls
session replay, surveys, autocapture and web-vitals machinery, "none of which this app uses."
Measured result: **190 KB → 103 KB, a 46% reduction.** CSP `connect-src` unchanged.

Three regression guards: two tests import the **real** slim module (not a mock) to assert
`__loaded` and `capture_pageleave` survive, and `PostHogProvider.render.test.tsx:20-22` mocks the
slim specifier so an edit back to the default entry fails.

### 5.6 Two user-data correctness fixes (v2.27.0)

- **#1239 — only OAuth registers a user.** `getStats()` used to end with a fire-and-forget
  `dbUpsertUser(handle)`, so *viewing a stranger's badge registered that stranger* and handed
  them to the hourly warm-cache cron. CLAUDE.md:166 records that Guido van Rossum, Linus
  Torvalds and `octocat` were all in the production `users` table this way. `dbUpsertUser` is
  now called from exactly one place: the OAuth callback.
- **#1240 — account deletion covers every handle-bearing table**, with a **migration-derived
  test that fails when a future table is omitted**.

---

## 6. Cross-cutting observations

Three patterns recur across otherwise unrelated work streams:

**Claims are measured, not assumed.** The `light-dark()` ADR quotes compiled build output rather
than trusting the browser floor. The badge palette rejects three of the handoff's literal hexes
with contrast measurements. The merge-promotion trade verified tree identity before deleting the
back-merge. The release timing rehearsal was clocked at ~30s. The squash finding was checked
against 30 repos.

**Guards assert the thing that actually failed.** The vercel.json guard asserts *location*
because behavior guards structurally could not catch it. The integrity contract's ordering is
enforced by *structure* (`_compose` runs after the guards close over their operands) rather than
by a check. `DynamicRouteShell.boundary.test.ts` enforces both presence and absence.

**Deletion is a frequent outcome.** −6823 lines of evidence-graph release tooling, −494 lines of
`UserMenu`, −405 lines of `BadgeContent`, three badge config categories dropped from the schema
rather than labelled, and an auto-back-merge workflow deleted rather than fixed.

---

## 7. Documentation drift found during this survey

These are observations of current state, not recommendations.

| Location | Says | Actual |
|---|---|---|
| `CLAUDE.md:145` | "Light is the default" | `ThemeProvider.tsx:22` — `defaultTheme="system"` (since #1173) |
| `design-system.md:104` | `defaultTheme="light"` | Same. (Inside a block marked superseded, but the note addresses only the teal-vs-slate reasoning.) |
| `globals.css:92-95`, `design-system.md:52` | forest family covers "the hero band, badge panel and CLI blocks" | Hero band moved to `--color-hero-band` in #1215; corrected at `design-system.md:89` |
| `design-system.md:225-226` | Primary button `bg-amber … hover:bg-amber-light` | `:109-111` — white text on solid fill needs `bg-amber-dark` base (`bg-amber` is 4.06:1) |
| `design-system.md:152`, `:295`, `:244` | "Accent text in headings uses `text-amber`" | `:110` — "Accent-coloured text is `text-amber-text`, never `text-amber`" |
| `design-system.md:407` | `BADGE_ACCENT_RGB` | Renamed to the per-palette `accentRgb` field by #1242 (`theme.ts:19-22`) |
| `QuickControls.tsx:25-33`, `studio-config-string.ts:9` | "six" categories | Seven since #1242 |
| `docs/plans/2026-08-29-...md:281` | lists `auto-backmerge-workflow.test.ts` under "Keep" | Deleted by `d4eb9abb` one day later |

**A note on session context:** the copy of `CLAUDE.md` injected into agent context during this
research was a **stale revision** — it carried the pre-#1206 violet accent and a 24h stats TTL.
The on-disk file at HEAD says jade (`CLAUDE.md:142`) and "TTL 6h primary, 7-day stale-fallback
tier" (`:161`). Verify against disk, not session context.

---

## 8. Open / unfinished items observed

- `docs/plans/2026-08-26-creator-studio-revival.md` Phase 5 (production flag flip) is
  **unchecked** and marked "requires Juan's explicit authorization."
- `docs/plans/2026-08-29-direct-proof-release-pipeline-notes.md:68-81` — the authorized Preview
  canary and the `gh api` branch-protection mutation were **not performed**.
- `docs/webmcp.md:7` — the tool catalog "still needs final production verification after release
  and flag enablement." Both WebMCP flags default to `false`.
- `docs/decisions/2026-08-30-one-badge-artifact.md:207-208` lists two follow-ups; both (#1225
  badge palette, #1226 heatmap naming) appear resolved in v2.26.0 per `CHANGELOG.md:118-146`.

---

## Key file index

| Area | Path |
|---|---|
| Color tokens | `apps/web/styles/globals.css` (`@theme` :23-144, color-scheme :147-161) |
| Theme control | `apps/web/components/{ThemeProvider,ThemeToggle}.tsx` |
| Badge renderer | `apps/web/lib/render/{BadgeSvg.tsx,theme.ts,badge-effects.ts,badge-config.ts}` |
| Badge config type | `packages/shared/src/types.ts:258-333` |
| Studio | `apps/web/app/studio/{StudioClient,QuickControls,BadgePreviewCard}.tsx` |
| Scoring guards | `apps/web/lib/github/{stats-integrity.ts,client.ts}` |
| Persist gate | `apps/web/lib/profile/{persist-guard,public-profile,materialize-profile}.ts` |
| Release tooling | `scripts/quality/*.ts`, `docs/release/release-playbook.md` |
| Cron config | `apps/web/vercel.json`, `scripts/check-vercel-config.ts` |
| WebMCP | `apps/web/lib/webmcp/`, `docs/webmcp.md` |
| ADRs | `docs/decisions/2026-08-{11,29,30}-*.md`, `docs/squash-vs-merge-release-topology.md` |

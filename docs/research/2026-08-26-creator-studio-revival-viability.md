# Research: Creator Studio — current state and revival viability

Date: 2026-08-26
Question: Is the hidden Creator Studio viable to bring back from its current
state (for the WebMCP hackathon entry)?
Method: 4 parallel research agents (locator, analyzer + empirical checks,
drift analyst, docs historian) over the repo at `develop` HEAD `b513861f`,
plus live production probes. All claims carry file:line or commit evidence.

---

## Executive answer

**Yes — revival is viable and cheap, with one honest limitation.** The Studio
is not bit-rotted: it typechecks clean, all 168 of its unit tests pass, its
schema has zero drift against the live app, and the CI release gate has been
silently exercising its save/readback path on every release since June. It is
one admin-panel PATCH away from being live. The limitation: **saved
customizations render nowhere public** — the badge SVG and share page ignore
the config entirely, by original design (#55) plus a later decoupling (#787).
The Studio is a self-contained preview playground: fully sufficient for the
WebMCP co-design demo, but the entry must not claim the customization reaches
the public badge unless that pipeline is built (it never existed for SVG).

---

## 1. How it is hidden

- Hidden 2026-02-13 by `a41b18dd` (issue #198: "isn't ready for launch...
  keeping all code intact for future release") — three days before v1.0.0
  shipped listing the Studio under "Added" (`CHANGELOG.md:1052,1059`). No ADR
  records the reason beyond that sentence.
- Gate: `apps/web/app/studio/page.tsx:66` `if (!(await isStudioEnabled()))
  redirect("/")`; API returns 404 (`app/api/studio/config/route.ts:22,63`).
  All seven entry points flag-gated (UserMenu link :462, terminal `/studio`
  command `command-registry.ts:261-269`, keyboard shortcut, cheat sheet,
  route, API, layout-provided client flags).
- Flag resolution (`lib/feature-flags.ts:62-95`): DB row `studio_enabled`
  wins outright; env `NEXT_PUBLIC_STUDIO_ENABLED` is fallback only when the
  row is absent or the 500ms DB lookup times out.
- **Production state VERIFIED live 2026-08-26**: `GET /api/feature-flags`
  shows `studio_enabled: false`, untouched since **2026-02-18**;
  unauthenticated `GET /api/studio/config` → 404. (`/studio` returns HTTP 200
  because ungated `generateMetadata` streams the title before the server
  `redirect("/")` executes — the 200 is a redirect shell, not a live page.)
- **Re-enable path requires no deploy**: `PATCH /api/admin/feature-flags`
  (admin auth, Zod-validated, invalidates cache + `revalidateTag`) — the
  admin panel's Agents tab exposes the toggle
  (`docs/scheduled-agents-admin-panel.md:477-478,990-993`).

## 2. Code health — empirical

- `tsc --noEmit` in apps/web: **exit 0, zero errors**.
- `pnpm exec vitest run apps/web/app/studio` (vitest 4.1.10): **10 files, 168
  tests, 168 passed, 1.62s**. Plus `api/studio/config/route.test.ts` and
  `route.contract.test.ts`, `lib/db/studio.test.ts`.
- Studio paths are fully inside the coverage gate (`vitest.config.ts:20-46` —
  no studio exclusion) and inside CI: `ci.yml:342` sets
  `NEXT_PUBLIC_STUDIO_ENABLED: "true"` for the journey job; the Playwright
  journey does login → studio save → Supabase readback
  (`e2e/journey.spec.ts:44,275,466`), and release evidence requires scenario
  `studio.config-persistence` (`quality/release-required.json:82-91`,
  `ci.yml:420`). **The hidden feature has been regression-tested on every
  release.**

## 3. Drift — schema none, renderer substantial

- **Schema: zero drift.** Pickaxe: `BADGE_CONFIG_OPTIONS` unchanged since its
  creating commit `d3b53beb` (2026-02-10). All 9 categories / 32 option
  values identical between `packages/shared/src/types.ts:269-292`,
  `app/studio/studio-options.ts:17-106`, and `lib/validation.ts:63-79`
  (validation derives from the shared constant; a test asserts parity).
- **Maintenance while hidden**: 69 commits ever touched the studio; every
  studio-source commit after 2026-04-03 is a repo-wide sweep (i18n,
  error-capture, flag unification #788 in v2.8.0, **durable Supabase store
  #935 / migration `027_create_studio_configs.sql` in v2.15.0, 2026-06-25**).
  Last studio-scoped feature work: `a186994e`, 2026-02-17.
- **Renderer divergence (the real drift)**: 53 commits landed on the badge
  render path since the last studio-subject commit. The served SVG
  (`lib/render/BadgeSvg.tsx:9-25` — `BadgeOptions` has no config field;
  `app/u/[handle]/badge.svg/route.ts:225-232` passes none) gained features
  the Studio preview knows nothing about: multi-platform branding row
  (`BadgeSvg.tsx:124-129`, GitLab/Bitbucket/Codeberg, `9801c4d4`),
  verification strip, static-heatmap-for-embeds + hardcoded
  `disableAnimation: true` (#760). Meanwhile the preview's effects modules
  are frozen at the 2026-03-01 palette refresh (`56bfbc09`) while the
  SVG-side `lib/render/theme.ts` kept evolving. **The Studio preview no
  longer looks like the badge users actually publish.**

## 4. The pipeline gap

Saved config terminates inside the Studio:

- Only readers of persisted config: `app/studio/page.tsx:83` (Redis) and
  `app/api/studio/config/route.ts:38,46,92`. No other production reference to
  `studio_configs` / `dbGetStudioConfig` exists in apps/web, packages, or
  supabase.
- The public profile page is *forbidden* from coupling to it:
  `app/u/[handle]/page.test.ts:25-33` asserts the source contains no
  `cacheGet<BadgeConfig>`, no studio imports — the residue of #787 (Apr 27),
  which removed the share page's earlier client-only custom-badge rendering.
- SVG customization was **explicitly out of scope in the original design**
  (issue #55: "SVG embed remains the standard... customization applies to
  share page + HTML embeds only"; confirmed `docs/badge-svg-spec-v1.2.md:5`).
- Net effect today: a user saving `aurora/crystal/holographic/confetti` gets
  a byte-identical public SVG to the defaults.

## 5. Latent defects relevant to revival

1. **Initial-load path bypasses the durable store.** `page.tsx:81-84` reads
   only Redis (`cacheGet`); the Supabase fallback lives in `GET
   /api/studio/config` (route.ts:46-52) — **which has no caller** in apps/web
   outside its own tests (`StudioClient` never fetches it). After Redis
   eviction, a saved config exists in `studio_configs` but the Studio loads
   `DEFAULT_BADGE_CONFIG`. The #935 durability fix reached the API but not
   the page.
2. **Blunt-500 seam** on `PUT` (any DB-layer false → flat 500, no
   idempotent-conflict handling) — already catalogued as Tier 1 in
   `docs/playbooks/reliability-hardening-playbook.md:258,322-327`.
3. The `/set` alias table exists in three hand-maintained copies
   (`command-registry.ts:51-62`, `useStudioCommands.ts:29-39`,
   `QuickControls.tsx:15-25`) — currently in agreement.
4. `/embed` and `/share` commands hardcode
   `https://chapa.thecreativetoken.com` (`useStudioCommands.ts:151-165`).
5. Mobile posture never resolved (issue #55 open question; playbook :344-348
   calls the studio controls path "least-tested, most-used").
6. Stale docs: `docs/spec.md:17` still says Redis-only persistence;
   `docs/user-manual.md:43-224` and `docs/demo.md:47-55` present the Studio
   as live with no availability caveat.

## 6. Revival cost assessment (for the WebMCP entry)

| Step | Evidence-based cost |
| --- | --- |
| Turn it on | Admin PATCH, no deploy. CI already runs it green. |
| Fix initial-load durability gap (§5.1) | Small: reuse the GET route's Redis→Supabase fallback in `page.tsx` (all pieces exist and are tested). |
| WebMCP tools over `useStudioCommands`/`CommandDef` | As planned — the command layer is intact, tested, schema-parity enforced. |
| Judge demo mode | As planned (anonymous sandbox handle, scratch config). |
| Preview-parity touch-up (branding row, verification strip in preview) | Optional, moderate — makes the preview honest vs. the real badge. |
| Making saved config affect the public share page / SVG | **New work, never existed** (SVG was always out of scope; share-page path was removed by #787 and is negatively tested). Not required for the hackathon demo, but the demo script must not imply it. |

**Conclusion**: the Studio can come back essentially as-was within a day, and
the WebMCP co-design flow (agent drives the command registry, human watches
the live preview, gated save) works on the existing, passing code. The only
scope decision for Juan: demo the Studio as the self-contained design
playground it is, or additionally build the config→share-page rendering
bridge (real new work, previously removed on purpose).

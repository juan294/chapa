# Phase 3 — Docs, ADR, CHANGELOG, version, release

Parent plan: `../2026-09-01-studio-save-badge-hotfix.md`. Depends on phases 1 and 2. Not batch-eligible.

## Goal

The repo describes the shipped behaviour, the release goes out as `v2.29.2` through the ordinary release path, and the production badge is verified fresh.

## Files

| file | change |
|---|---|
| `docs/decisions/2026-09-01-badge-edge-cache-purge.md` | **new** ADR |
| `docs/decisions/2026-08-30-one-badge-artifact.md` | append a dated correction under "Versioning" |
| `CLAUDE.md` | `:156` (saving invalidates …), `:186-187` (badge headers) |
| `CHANGELOG.md` | `[2.29.2]` under `Unreleased` → dated |
| `apps/web/package.json` | `"version": "2.29.2"` |
| `docs/how-it-works.md` | `:222` still true (edge 6h); add one clause on the per-handle purge |

## Steps

### 3.1 ADR `docs/decisions/2026-09-01-badge-edge-cache-purge.md`

Sections, each short:
- **Context**: the measured incident (edge `age: 2254` copy from before the save; three PUTs at 20:04 UTC; Redis correct; README stale). Link the research doc.
- **Decision**: per-handle `Vercel-Cache-Tag`, split `Cache-Control` / `Vercel-CDN-Cache-Control`, `dangerouslyDeleteByTag` from the one shared invalidation helper, awaited on the save path. Why foreground delete rather than background invalidate (one tag = one handle; the next viewer must see the change).
- **Rejected**: shortening the edge TTL (README lag equals TTL; weakens the edge's protective role for every badge); putting the config revision in the cache key (already rejected in the 2026-08-30 ADR, still true).
- **Consequences**: `badgeRefreshed` in the save response and the deferred copy; a redeploy still purges the whole edge; `edge: "skipped"` outside Vercel; the `badge_edge_purge_failed` event; OG image left for a follow-up.
- **Rule going forward**: a cache invalidation triggered by a user action is awaited, never `fireAndForget`; `fireAndForget` is for telemetry and opportunistic cache fills.

### 3.2 Correction to `docs/decisions/2026-08-30-one-badge-artifact.md`

Under "Versioning", after `:134` ("That is self-healing and cheap …"), add:

> **Correction (2026-09-01, v2.29.2).** "Stale until the day rolls over" described only the Redis layer. The badge is also cached by Vercel's edge for six hours (plus a 24-hour stale-while-revalidate window) per URL and PoP, and a Redis delete does not reach it, so a save was invisible on the README for up to a day. The invalidation now purges a per-handle edge tag as well, and the Studio save awaits it. See `2026-09-01-badge-edge-cache-purge.md`.

### 3.3 `CLAUDE.md`

- `:156`: after "and saving invalidates that handle's badge cache (#1191, step 3)" add: "in both layers — the Redis SVG keys and the Vercel edge, by the per-handle `Vercel-Cache-Tag` the badge route sets — and the save response reports `badgeRefreshed` (v2.29.2)."
- `:186-187`: replace the header bullet with the three-header block from the plan and one sentence: "`Cache-Control` is what browsers and GitHub's image proxy see (Vercel strips `s-maxage` from it); the edge policy lives in `Vercel-CDN-Cache-Control`; the tag is what `invalidateBadgeSvgCacheForHandle` purges."

### 3.4 `CHANGELOG.md`

```
## [2.29.2] - 2026-09-0X

### Fixed

- **A saved Studio configuration now reaches the badge people embed.** The
  save awaited the database write but launched the badge-cache invalidation
  after the response, and nothing cleared Vercel's edge cache at all, so the
  README kept showing the previous badge for up to a day. Every badge response
  now carries a per-handle cache tag, the shared invalidation purges that tag
  alongside the Redis keys, the Studio save waits for it, and the success line
  says what actually happened instead of "your public badge is unchanged".
  Browsers and GitHub's image proxy are told to recheck every five minutes.
```

Version bump `apps/web/package.json` → `2.29.2`.

### 3.5 Release

Follow `docs/release/release-playbook.md` exactly; both gates are the owner's, not the implementer's:

1. Everything merged to `develop` with CI green (`pnpm run release:validate-docs` included).
2. Gate 1: version `2.29.2` + full diff approval.
3. Gate 2: authorization to open and merge the `develop` → `main` **merge-commit** PR and to tag. Never squash (#1228).
4. After deploy: `curl -s https://chapa.thecreativetoken.com/api/version` shows the new SHA. The deploy itself purges the edge, so the stale copy from 2026-09-01 19:46 UTC is gone regardless.
5. Production proof, once: save in Studio, `curl -sI https://chapa.thecreativetoken.com/u/<handle>/badge.svg` → `MISS` then `HIT` with the new body. Then confirm the GitHub README picks it up within about five minutes (camo now sees `max-age=300`; if it lags, a `curl -X PURGE` on the camo URL is the documented GitHub-side workaround and is out of our hands).

### 3.6 Follow-up issues to open (do not fix here)

- OG image not invalidated by a Studio save (`og-image:v3:<handle>:<date>:<locale>`, 48h; same 6h edge policy, untagged).
- `scripts/recalculate-handles.ts:184` stale `BADGE_RENDER_VARIANT = "warm-amber-v3"`.
- Write the `fireAndForget` vs `after()` vs await rule into `.claude/rules/` (the ADR states it; a rule file makes it load automatically).

## Verification

```
pnpm run release:validate-docs
pnpm run test
pnpm run lint
```

## Done when

- `v2.29.2` tagged on `main`, `/api/version` reports its SHA.
- Production proof (3.5 step 5) recorded in the PR.
- The three follow-up issues exist with `type:`/`priority:`/`area:` labels.

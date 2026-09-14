# Phase 5 — Manual owner journey, desktop and mobile

Goal: walk the product as the owner does, with a real GitHub login, in real
Chrome, in both locales and both themes, at 1440, 768, 390 and 320 px.
This phase also carries the surface matrix that `redesign-surfaces.spec.ts`
cannot run against production data. Claude in Chrome drives most of it
(`resize_window`, `computer`, `read_console_messages`,
`read_network_requests`); the GitHub consent and 2FA screens are the user's.
Screenshots: `evidence/phase5/<step>-<locale>-<theme>-<width>.png`.

Every step records the console error count and the first network response
≥ 400 on that page; a non-zero count is a finding.

Writes in this phase, all on `juan294` and reversed in 5.3 or Phase 8:
OAuth upsert of the existing user row, generate/refresh snapshots, Studio
config saves. Nothing else may write.

## 5.1 Login and generation

1. `/` signed out → `Login` → GitHub → back on `/`. Session pill shows the
   avatar; `GET /api/auth/session` returns the login.
2. `/generating/juan294` → progress screen → `/u/juan294`. `POST /api/generate`
   is 200 (a first-call 502 is #1282/#1283 regressing).
3. `GET /api/studio/config` from this session → save the JSON as
   `evidence/phase1/juan294-studio-config.json`; it must equal the SQL
   capture from Phase 1.3. **This is the restore reference.**

## 5.2 Share page as owner and as visitor

- Owner: header pairs identity with the headline score, tier pill and
  verification pill; "How is my score calculated" shows confidence and
  penalty reasons; dimension cards, insights, sub-metric panel, heatmap with
  tooltips (hover, tap, keyboard); share toolbar (copy Markdown, copy HTML,
  share to each destination with the platform named); embed copy reports its
  real result.
- Visitor (incognito): confidence absent from the page and from the RSC
  payload (`view-source`, search `confidencePenalties`); JSON-LD present;
  badge `<img>` src is `/u/juan294/badge.svg`.
- Locale switch EN↔ES keeps path, query and hash; `<html lang>` and navbar
  agree; no reload loop.
- Cold share page placeholder (8fcc0371 follow-up): `POST /api/refresh?handle=juan294`
  from the owner session, then open `/u/juan294` in a fresh tab and **watch**
  the "BUILDING THE BADGE" panel at the top: it must be replaced by the
  rendered badge without a manual reload, within the page's own load. Record
  how long it took and whether a reload was needed. Repeat once for
  `/u/octocat` as a visitor.

## 5.3 Studio

| Step | Expect |
|---|---|
| Stage top sits under the 69 px navbar at every width | no overlap |
| Fit / 50 % / 100 % | frames keep their width in the scroller (`shrink-0`); saved config unchanged |
| Each of the 7 categories via Quick Controls, then via `/set` | preview changes; config summary line and `/copy config` update |
| Palette Ice→Jade→Indigo→Amber→Crimson→Mono | accent and ground change; verification strip stays coral |
| `/save` | pill dirty→saving→saved; `PUT /api/studio/config` 200, `badgeRefreshed: true`; `GET /u/juan294/badge.svg?ts=<now>` on 3001 shows the new palette; share page and `/u/juan294/og-image` follow |
| Forced 503 (DevTools request blocking on the PUT) | error state, config stays dirty, retry succeeds |
| Navigate away with unsaved changes | native unload confirmation; cancel keeps the page |
| `/reset` then `/save` | Ice defaults published |
| **Restore**: `PUT /api/studio/config` with the 5.1 JSON, then `GET` | `revision` advanced, `config` deep-equals the reference; badge on 3001 matches `evidence/phase1/juan294.svg` except timestamps |
| Session log grows past the stage | badge stays on screen (ab6e01a6) |
| `/studio?demo=1` signed out | demo marker, 82 / High / Balanced, Quick Controls collapse |
| Reduced motion (DevTools rendering) | SVG animations paused, full data visible |

Production consequence, stated once: between the first save and the restore
the `juan294` row in production differs from today's. Production's own
cached badge (`jade-v1` keys, 6 h edge) is not purged from localhost, so it
keeps serving today's image; restoring within the session means the next
production re-render matches what it renders now. Keep the window short.

## 5.4 Settings

`/settings`: connections for Bitbucket, Codeberg, GitLab show status and a
connect action; start one connect flow and confirm the redirect to the
provider with a `state` cookie set, then cancel at the provider (a completed
link writes `user_platforms` in production and is not needed here);
insights import accepts a small fixture report and shows one toast per
outcome with a stable identity (#1292); identity block shows handle, name,
avatar. Publication consent is **absent** while v7 is off (Phase 6 turns it
on through the env fallback).

## 5.5 Admin, read-only

`/admin`: users table lists the production users with a link per handle,
sortable columns, command bar. Do not press refresh on another user's row.
`PATCH /api/admin/feature-flags` is exercised only for validation: an empty
body returns 400 "No updates provided"; no key is toggled. Mobile: the table
is bounded and scrolls inside its container.

## 5.6 CLI device authorization

```bash
curl -s "http://localhost:3001/api/cli/auth/poll" | jq .      # session + device_code
```
Open `/cli/authorize?session=<session>` logged in, approve, poll again
echoing `device_code` → token; a poll without `device_code` still works.
Exercise the token read-only: `scripts/supplemental-evidence-client.ts --fixture`
**without** `--send` (a send would compose synthetic evidence onto the
owner's real production score).

## 5.7 Logout and global chrome

`POST /api/auth/logout` clears the cookie; `/studio` and `/settings` show the
signed-out state. Navbar: logo cursor, LanguageSwitcher listbox (arrows,
Escape returns focus), ThemeToggle cycles system→light→dark and persists;
`/` and Mod+K focus the command input from every page; dock keeps the last
50 commands while mounted; `/theme dark` agrees with the toggle; footer
links resolve. Log back in before 5.8.

## 5.8 Surface matrix (replaces `redesign-surfaces` and `redesign-reflow`)

For each of EN, ES × light, dark:
- 1440 and 390: `/studio` owner (stage, zoom controls, one `/set`, no save),
  `/settings`, `/admin`, `/cli/authorize?session=x`, `/u/octocat` visitor,
  `/verify/<hash from the octocat strip>`, `/studio?demo=1`, `/` with
  `prefers-reduced-motion`.
- 768 and 320: `/`, `/u/juan294`, `/studio`, `/about/scoring`.
- 1440 at 200 % browser zoom: `/` and `/u/juan294`.

At each: no horizontal scrollbar, no text below the 11 px floor except the
documented uppercase micro-labels, tap targets ≥ 44 px (navbar controls,
dock input, Studio option buttons, share toolbar, tooltip triggers),
tooltips stay inside the viewport and flip near the top, the fixed dock does
not cover the footer's last link, Mod+K lands focus inside the viewport,
`Home`/`End` move between archetype tabs.

## Exit criteria

Every row checked with a screenshot and zero console/network errors, or a
finding with step, width, locale and theme. Studio config restored and
verified against the reference. Owner session still logged in for Phase 6.

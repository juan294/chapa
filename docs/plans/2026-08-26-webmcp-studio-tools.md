# Plan: WebMCP Layer — Studio Tools, Demo Mode, Public Read Tools

Date: 2026-08-26. Hard deadline: 2026-09-03 13:00 PT (WebMCP Challenge).
Research inputs: `archy/docs/research/2026-08-26-webmcp-hackathon-fit.md`
(strategy), `docs/research/2026-08-26-creator-studio-revival-viability.md`,
two code sweeps 2026-08-26 (cited inline in phase files), Chrome WebMCP
imperative-API docs + W3C spec (API contract below).

## Pinned API contract (from Chrome docs + spec, 2026-08-26)

`document.modelContext.registerTool(tool, { signal })` where tool =
`{ name, description, inputSchema (JSON Schema), execute(inputs, {signal}),
annotations?: { readOnlyHint, untrustedContentHint }, title? }`.
Unregistration = `AbortController.abort()` (maps to React effect cleanup).
Tools die on navigation/unload automatically. Chrome: origin trial (149+) or
`chrome://flags/#enable-webmcp-testing`; "origin-isolated documents" only.
Test tooling: Model Context Tool Inspector extension. Feature-detect with
`"modelContext" in document` — graceful no-op everywhere else.

## Design decisions (made, with rationale)

1. **Two feature flags**, seeded in one migration `035_seed_webmcp_flags.sql`:
   `webmcp_enabled` (gates all tool registration; remote kill-switch via
   admin PATCH) and `studio_demo_enabled` (gates `/studio?demo=1`). Plumbed
   through the 6 enumerated touch points (see phase-1).
2. **Demo mode saves are local-only.** `/studio?demo=1` uses the existing
   `DEMO_STATS`/`DEMO_IMPACT` fixtures (`lib/render/demoData.ts`), skips
   session/token gates, and `/save` exercises the human-confirm gate but
   persists nothing — success line reads "(demo) not persisted". Zero API
   changes, zero real-data exposure, `robots noindex` like `experiments/`.
3. **Tools return strings** (spec: serialized result). Structured JSON gets
   `JSON.stringify`'d; every tool result is derived from the same code paths
   humans use (command registry, pure scoring fns, public APIs).
4. **Save is human-gated**: `save_badge_config` never calls PUT; it arms an
   on-page confirmation affordance; only the human's click saves.
5. **No polyfill by default** — the spike decides; CSP `script-src` has no
   external origins, so if needed it's `pnpm --filter @chapa/web add` and
   bundled, never CDN.

## Phase overview

| Phase | Title | Depends on | Batch |
| --- | --- | --- | --- |
| 0 | Runtime spike (BOTH judging clients) — gate for everything | — | first, alone |
| 1 | WebMCP infra: `useModelContextTools` hook + 2 flags | 0 | — |
| 2 | Studio tools over the command registry + gated save | 1 | overlaps 3 (StudioClient/page) — run before 3 |
| 3 | Judge demo mode `/studio?demo=1` | 1, 2 | — |
| 4 | Public read tools on `/u/[handle]` + `/verify/[hash]` | 1 | [batch-eligible] with 2+3 chain |
| 5 | Submission assets: README split, video script, checklist, publication runbook | content-complete after 2-4 | [batch-eligible] docs part; publication + submission are MANUAL, Juan-gated |

## Implementation status

- [x] Phase 0 — runtime spike passed in flagged Chrome 151
- [x] Phase 1 — WebMCP infrastructure and feature flags
- [x] Phase 2 — Studio tools and human-gated save
- [x] Phase 3 — judge demo mode
- [x] Phase 4 — public read tools
- [x] Phase 5 — submission assets and gated runbook (manual execution pending Juan approval)

## Success criteria

Automated: chapa gates — `pnpm run typecheck && pnpm run lint && pnpm run
test`, `test:coverage`, `check:write-registration` (no new write routes
expected — demo mode adds none), `test:contract:local`, `pnpm run
validate:migrations`. New unit tests per phase (registration hook with a
mocked `document.modelContext`; tool execute fns as pure functions).

Manual (unavoidable, why): Phase 0's client verification (real browser
runtimes, no automatable harness for ChatGPT's browser); Phase 5's repo
publication + Devpost submission (outward-facing, Juan-authorized); final
demo-video recording (human narration).

## Calendar guardrail

Aug 27: Phase 0 + 1. Aug 28: Phase 2. Aug 29: Phases 3+4. Aug 30: Phase 5
docs + release to main + prod verification. Aug 31-Sep 1: video + submission
draft. Sep 2: buffer. Sep 3 13:00 PT: deadline. The release must ride
develop→main (prod deploys from main) — schedule it no later than Aug 31.

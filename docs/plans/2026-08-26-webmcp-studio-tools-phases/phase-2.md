# Phase 2 — Studio tools over the command registry (the leverage core)

Architecture claim this phase makes true: ONE command layer, THREE drivers
(clicks via QuickControls, typed terminal, agent via WebMCP) — verifiable in
one file.

## 2A. `handleSubmit` returns the result (StudioClient.tsx:276-297)

```
- const handleSubmit = useCallback((input: string) => { ... }, ...)
+ const handleSubmit = useCallback((input: string): CommandResult<StudioCommandAction> => {
    ...existing body unchanged...
+   return result;            // executeCommand's return — lines + action
  }, ...)
```
Backward-compatible (existing callers ignore the return). RED first: extend
`StudioClient.test.tsx` — handleSubmit path returns the lines the terminal
shows.

## 2B. `apps/web/app/studio/useStudioWebMcpTools.ts` (new)

Hook consuming what StudioClient already has; registered via Phase 1's
`useModelContextTools(tools, flags.webmcpEnabled)` inside StudioClient:

| Tool | inputSchema | execute (pseudocode) | annotations |
| --- | --- | --- | --- |
| `list_style_options` | `{}` | serialize STUDIO_CATEGORIES (key, alias, label, options[{value,label,description}]) + STUDIO_PRESETS + current config | readOnlyHint |
| `apply_badge_style` | `{category: string, value: string}` (enum-less; registry validates) | `runCommand("/set ${category} ${value}")` | — |
| `apply_preset` | `{name: enum minimal/premium/holographic/maximum}` | `runCommand("/preset ${name}")` | — |
| `preview_badge` | `{}` | current config JSON + badge SVG URL + saveState.status | readOnlyHint |
| `reset_badge_config` | `{}` | `runCommand("/reset")` | — |
| `save_badge_config` | `{}` | **arm confirm gate** (below); returns "Save proposed — the user must confirm on-page." | — |
| `simulate_score` | `{dimensions: {delivery?..craft?: number 0-100}}` | pure: merge overrides into current dimensions → composite = mean(active DIMENSION_KEYS) → adjusted via lib/impact/utils adjusted-score fn with current confidence → tier via getTier. Returns {composite, adjusted, tier, deltaVsCurrent} | readOnlyHint |
| `suggest_improvements` | `{}` | `generateInsights(impact, null, null, t)` (lib/dashboard/generate-insights.ts:119 — existing grounded engine, includes next-tier gap) serialized | readOnlyHint |
| `explain_dimension` | `{dimension: enum}` | `getDimensionSubMetrics(dimension, stats, impact.profileType, craftResult?)` + the dictionary's `dimensions.*.tip` / `scoreExplanation.*Formula` strings | readOnlyHint |

`runCommand` = Phase 2A's returning `handleSubmit`; tool result =
`result.lines.map(l => l.text).join("\n")` + new config snapshot. The agent's
actions are thereby VISIBLE in the terminal (input line + result lines
appear on screen) — the shared-screen story, for free.

## 2C. Human-gated save

New state in StudioClient: `pendingAgentSave: boolean`. `save_badge_config`
sets it + appends a system line ("Agent proposed saving — confirm below").
UI: a confirm affordance rendered next to the existing /save button
(reuse its styling) with Confirm → existing `handleSave()` + clears pending;
Dismiss → clears pending + info line. The agent tool NEVER calls handleSave.
RED first: StudioClient tests — tool arms the gate, PUT not called until
confirm click, dismiss cancels.

## Files
`StudioClient.tsx`, new `useStudioWebMcpTools.ts` (+test), `studio` i18n
keys (en+es, parity test), `lib/impact` untouched (pure imports only).

Verification: full gates. simulate_score RED-first as pure-function tests
(fixed dimension inputs → known composite/adjusted/tier using
TIER_THRESHOLDS from @chapa/shared — import, don't hardcode 30/70/85).

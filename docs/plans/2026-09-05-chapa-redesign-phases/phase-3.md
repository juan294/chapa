# Phase 3 — Landing composition, copy and developer shell

Parent: [implementation plan](../2026-09-05-chapa-redesign.md). Dependencies: Phases 1–2. Not batch-eligible.

## Result

The real landing matches the approved design, includes the user’s copy and 92/Elite sample, and supports keyboard navigation through the existing terminal machinery in both languages/themes.

## Files and evidence

- `apps/web/app/[locale]/page.tsx:40`, `apps/web/app/LandingContent.tsx:111`, `apps/web/app/LandingTerminal.tsx:7`, `apps/web/app/LandingUrlEffects.tsx:1`: server body/client leaves.
- New `apps/web/lib/render/landing-demo-data.ts` and its test: landing-only fixture.
- New client leaves under `apps/web/components/landing/`: archetype explorer, scoring interaction and scoped command composition; create only modules with distinct interaction ownership.
- `apps/web/components/GlobalCommandBarLazy.tsx:11`: extend its forwarding contract for scoped commands, or make `LandingTerminal` the client bridge that composes them before passing to the lazy bar. Keep server-to-client props serializable; callbacks are created inside the client boundary.
- `apps/web/components/GlobalCommandBar.tsx:62`, `apps/web/components/terminal/command-registry.ts:221`, `apps/web/components/terminal/TerminalInput.tsx:68`, `apps/web/components/terminal/AutocompleteDropdown.tsx:48`, `apps/web/components/KeyboardShortcutsListener.tsx:180`, `apps/web/lib/keyboard/shortcuts.ts:92`: shared command implementation.
- EN/ES dictionaries; `apps/web/components/CopyButton.tsx:8`, `apps/web/hooks/useCopyToClipboard.ts:1`; `apps/web/lib/webmcp/site-tool-map.ts:1`, `apps/web/components/LandingWebMcpTools.tsx:23`: existing integration contracts.

## Composition and copy (pseudocode)

```text
LANDING_IMPACT = independent illustrative ImpactV6Result:
    adjustedComposite 92; tier = getTier(92)
    compositeScore 92; confidence 100; no confidence penalties
    dimensions {delivery:96,quality:88,consistency:94,breadth:90,craft:92}
    retain demo identity/profile type/date shape
    archetype = deriveArchetype(dimensions, profileType) -> Balanced
    never mutate DEMO_IMPACT; never run materialization or mint a seal
    disclose curated simulated values (not claimed output of scoring computation)

Home(locale params):
    translated strings = buildBadgeI18nStrings(t, LANDING_IMPACT.tier)
    heroSvg = renderBadgeSvg(DEMO_STATS, LANDING_IMPACT, demo + strings + Ice)
    readmeSvg = same renderer/inputs with disableAnimation:true
    pass both and same impact to LandingContent

LandingContent remains server component:
    existing NavbarClient + LandingUrlEffects
    hero: developer prompt, GOOD WORK / LEAVES A / MARK_, plain explanation,
          real inline badge + overlay, Open the Creator Studio -> /studio
    platform strip: canonical platform identity
    identity section: Your work is more than a commit count
    seven-archetype explorer: keyboard tabs, paired labels, guide links
    scoring: four core dimensions + optional Craft, native details/summary
    README: <img src=encoded static rendered SVG>, localized alt + shared copy hook
    enterprise/EMU CLI explanation retained
    agent catalog: SITE_TOOL_MAP data + localized goal descriptions, transcript link
    verification: actual /verify and methodology links, explicit trust explanation
    closing CTA + existing footer/attribution
    persistent existing terminal + signature
```

Use the exact parent copy table. The proposed dimensions are illustrative, separately curated for the aspirational sample; no claim is made that the unchanged demo activity computes to 92. Derive the matching Balanced archetype through the existing helper (`apps/web/lib/impact/v6.ts:307`), not a duplicated rule. Keep all numbers in hero/overlay/summary/alt text derived from this one fixture; explorer archetypes keep their own distinct illustrative examples. No scoring-source edits.

For the README use an encoded data URL from `readmeSvg`, which keeps live renderer semantics and avoids duplicate inline defs. Do not add a public sample API or make network calls for this sample. Preserve existing example embed-copy behavior and honest copy status; never copy a fabricated personal profile as if owned by the visitor.

Retain compatible anchors `#features`, `#how-it-works`, `#scoring`, `#enterprise`, `#agent-tools`, `#badge-preview`. They may be semantic wrapper IDs or aliases on the new sections. Existing `/about`, scoring/archetype guides and auth links remain real routes. No `/badge-lab` product route or CTA ships.

## Command behavior contract

| Command | Behavior |
| --- | --- |
| `/help` | Localized help generated from actual available composed registry; no invented commands |
| `/home`, `/about`, `/scoring`, `/builder` etc. | Preserve existing global routes; add missing `/artificer` guide route |
| `/archetypes [type]` | Landing-only scroll/select one of seven known IDs; invalid arguments show localized usage |
| `/dimensions [dimension]` | Landing-only scroll/open scoring detail; four core IDs and Craft accepted |
| `/section <id>` | Landing-only navigate to a known section; reject unknown IDs with localized usage |
| `/embed`, `/mcp` | Landing-only scroll to README/actual tool catalog |
| `/copy` | Landing-only same illustrative embed-copy action as visible Copy button |
| `/verify` | Navigate to existing `/verify` |
| `/theme [light|dark|system]` | Read/set the current provider theme; invalid args do not mutate; no argument reports current choice |
| `/whoami` | Landing-only identifies this as sample exploration; does not invent a login/session or claim sample identity belongs to visitor |
| `/clear` | Clear transient output and input, preserve preference and session history |
| `/studio`, `/login`, `/badge <handle>`, `/b`, legal/admin commands | Existing feature gates, auth route and navigation semantics |

`/dimensions` is the deliberate production equivalent of prototype `/scoring <dimension>`; it avoids changing the existing `/scoring` route contract. Section markers use their actual production commands. `/section` accepts a fixed map: `hero`→hero, `identity`→identity narrative, `features`→archetypes, `scoring`→dimensions, `how-it-works`→README steps, `embed`→README, `enterprise`→EMU/CLI, `agent-tools`→catalog, `trust`→verification and `closing`→closing CTA. Keep map entries tied to rendered IDs with a test. All sections remain reachable by slash commands; pointer links work without entering commands.

```text
compose existing navigation + scoped landing commands using CommandDef/CommandAction
keep parse/match/execute and navigateInApp (including unsaved navigation)
add localized message inputs for touched help/error/navigation outputs
add explicit TerminalInputHandle.fill(value), reuse for clickable prompts/chips
track bounded in-memory command history; feed existing input history prop
global mod+K focuses existing terminal; consolidate Studio focus ownership
slash respects existing editable-input guards
help/output remains readable until next input, /clear or Escape when extended help
autocomplete/chips/help reflect same commands and feature flags
```

Do not use prototype document-wide DOM scripts. Keep one shortcut listener per page and the existing `skipShortcutsListener` behavior. Preserve Arrow/Tab/Enter/Escape semantics and combobox IDs across locale changes. Clipboard failure must show failure; `/whoami` and `/copy` are presentation actions, not backend tools. Keep WebMCP registration/map/schema unchanged; translate catalog descriptions separately from machine tool names.

## Automated success criteria

- [ ] Landing remains static/server-rendered, preserves OAuth error/query behavior, and renders both languages with exact hero/Studio copy.
- [ ] Hero/README derive from same 92/Elite fixture with simulated/sample disclosure; shared `DEMO_IMPACT` remains High82.
- [ ] Explorer keyboard tabs cover all seven archetypes; dimension commands open matching details; invalid arguments are handled.
- [ ] Help/autocomplete/history/Tab/Enter/Escape, global and Studio mod+K, slash input guards, theme command/picker agreement and copy success/failure pass.
- [ ] Signature, language picker, theme picker, old anchors, footer/enterprise content and actual tool catalog remain present.
- [ ] No duplicate inline SVG IDs from README; actual static SVG is used.
- [ ] Parent gate commands pass; update old copy-specific E2E expectations without deleting locale/reflow/navigation checks.

Focused commands (include new colocated leaf/fixture tests in the full gate):

```sh
pnpm exec vitest run apps/web/app/LandingContent.test.ts 'apps/web/app/[locale]/page.render.test.tsx' apps/web/components/GlobalCommandBar.render.test.tsx apps/web/components/terminal apps/web/lib/keyboard apps/web/components/AuthorTypewriter.test.tsx apps/web/components/BadgeOverlay.render.test.tsx apps/web/lib/i18n/dictionaries/parity.test.ts apps/web/lib/webmcp
```

Against the reviewed local server:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @chapa/web exec playwright test e2e/landing.spec.ts e2e/navigation.spec.ts e2e/theme.spec.ts e2e/static-pages.spec.ts --project=chromium --project=mobile --workers=1
```

## Manual visual success criteria

- [ ] Rubric landing matrix passes EN/ES × light/dark × desktop/mobile; expressive layout, angled badge and technical shell are recognizable.
- [ ] The hero plainly explains the product; no “badge lab” text remains in product UI.
- [ ] Sample is readable, Elite and clearly illustrative; image/tooltips align in the rotated stage.
- [ ] Complete keyboard-only tour works, including shell, explorer, copy, language/theme and Studio navigation; no dock occlusion or horizontal page overflow.

Stop after presenting the implemented landing and interaction evidence.

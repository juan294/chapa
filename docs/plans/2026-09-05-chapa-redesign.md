# Chapa redesign implementation plan

Date: 2026-09-05  
Phase: Implementation; Phases 1–3 complete, Phases 4–5 in progress.  
Baseline: `develop` at `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d`.  
Research: [design system and product contracts](../research/2026-09-05-chapa-redesign-design-system.md), [measurements and user brief](../research/2026-09-05-chapa-redesign-evidence.json).

## Outcome

Bring the approved paper/ink/vermilion/ice design into Chapa: expressive editorial composition around a working developer shell, light/dark/system themes, a real versioned Ice Terminal SVG badge, and consistent shared product UI. Preserve Creator Studio, English/Spanish, visible language/theme controls, the animated author pill, existing product flows and the code-to-Claude Design format.

The landing sample becomes **92 / Elite**, explicitly simulated. Near the hero, include the user's exact sentence: **“Turn your development activity across platforms into a profile and badge you can share.”** Retain **“Your work is more than a commit count.”** The badge CTA reads **“Open the Creator Studio”** and targets `/studio`.

This plan specifies five sequential implementation gates. Each gate produces a locally reviewable result and stops. It authorizes no push, preview deployment, release, remote cache purge or production data change. RPI phase boundaries: `CLAUDE.md:313`, `.claude/rules/rpi-details.md:24`.

## Checkable design references

- Approved page: `/Users/juan/code/chapa-redesign/index.html:1`, `/Users/juan/code/chapa-redesign/style.css:1`, `/Users/juan/code/chapa-redesign/theme.css:1`, `/Users/juan/code/chapa-redesign/script.js:1`, `/Users/juan/code/chapa-redesign/shell.js:1`, `/Users/juan/code/chapa-redesign/theme.js:1`, and `/Users/juan/code/chapa-redesign/CONCEPT.md:9` under that same directory.
- Approved badge: `/Users/juan/code/chapa-redesign/badge-lab/ProposalSvg.ts:1`, `/Users/juan/code/chapa-redesign/badge-lab/proposal-theme.ts:1`, `/Users/juan/code/chapa-redesign/badge-lab/PROPOSAL.md:59`, `/Users/juan/code/chapa-redesign/badge-lab/version.json:3` under that directory.
- [Reference manifest](2026-09-05-chapa-redesign-phases/reference-manifest.json) pins these local artifacts by SHA-256. Phase 1 archives the exact references for portable review before editing application code. The prototype is a visual/interaction specification; its scripts, second renderer and private Jade→Ice adapter do not become production architecture.
- [Acceptance rubric](2026-09-05-chapa-redesign-phases/acceptance-rubric.md) is the review contract for every phase. The user’s later copy, Elite sample and Studio corrections override older text in the prototype.

## Decisions and trade-offs

| Decision | Selected approach | Alternative and trade-off |
| --- | --- | --- |
| Theme architecture | Update existing named tokens in one `@theme` block, paired with `light-dark()`; keep `next-themes` and `data-theme` scheme wiring | Importing prototype theme overrides would create a second source and break the existing sync contract |
| Typography | JetBrains Mono remains heading/terminal/UI identity; Manrope becomes body; additive `font-display` supplies Barlow Condensed for expressive headings | Rebinding every heading to Barlow would remove the technical identity from controls and content pages |
| App palette | Paper/charcoal grounds, vermilion/coral emphasis, ice stages, fixed ink terminal surfaces | Recoloring only accent utilities would leave the approved spatial and typographic redesign unimplemented |
| Badge | One global `ice-terminal-v2` renderer; additive `ice` palette; preserve all existing palette IDs/colors | Supporting selectable historical layouts adds an unrequested configuration dimension and multiple rendering contracts |
| Saved colors | Explicit saved palettes survive; legacy stored rows missing palette fill with Jade; no-row/new/reset defaults use Ice | Mapping `jade` to Ice, or filling old rows from a changed default, silently overwrites color intent |
| Elite example | Landing-only fixture, adjusted score 92, tier through existing `getTier`; existing shared demo untouched | Changing shared demo changes Studio and unrelated fixture baselines; changing scoring thresholds changes the product |
| Commands | Compose landing commands using existing registry, input, output, autocomplete, shortcut and navigation machinery | Copying `shell.js` creates a second implementation and loses locale/unsaved-navigation integration |
| Multiple badge instances | Inline animated hero with overlay; README uses a static SVG data URL rendered from the same inputs | Duplicating inline SVG introduces duplicate defs/IDs; a hand-drawn badge loses live document semantics |
| Sync delivery | Keep current package/config/15 exports and produce local CSS/token evidence; actual converter/upload/readback is separately recorded when available | Local token emission alone cannot prove remote Claude Design synchronization |

The badge layout changes globally when released, including badges with saved Jade palettes; their color choice survives. Accounts without a saved config receive the new Ice default. Existing invalid/unavailable config fallback remains non-cacheable and uses the new default. No database backfill is part of this redesign (`apps/web/lib/render/badge-config.ts:35`, `apps/web/lib/db/studio.ts:179`, `apps/web/lib/validation.ts:131`).

## Scope and invariants

| Contract | Implementation rule | Existing check/source |
| --- | --- | --- |
| Design system | Retain existing token names/aliases and paired declaration format; additive semantic roles allowed; no schema replacement | `apps/web/styles/tokens.test.ts:62`, `.design-sync/emit-tokens.mjs:53` |
| Theme | System default; picker and `/theme` share provider/persistence; no badge palette changes from page theme | `apps/web/components/ThemeProvider.tsx:22`, `apps/web/components/ThemeToggle.tsx:11` |
| Languages | Every new product string, command output, badge heading and accessible label has EN/ES keys; retain canonical URL/cookie behavior | `apps/web/lib/i18n/dictionaries/parity.test.ts:43`, `apps/web/proxy.ts:67` |
| Static landing | Server-rendered translated body; client leaves only for interactions; retain query/error handling | `apps/web/app/LandingContent.test.ts:39`, `apps/web/app/[locale]/page.tsx:18` |
| Navigation | Preserve auth/session/admin controls, public routes, feature gates and unsaved-navigation interception | `apps/web/components/NavbarShell.tsx:41`, `apps/web/components/GlobalCommandBar.tsx:82` |
| Signature | Preserve `</> JG`, messages, links, animation timings, reduced-motion and popover; keep recognizable pill shape and desktop right-edge mount | `apps/web/components/AuthorTypewriter.tsx:10`, `apps/web/components/GlobalCommandBar.tsx:161` |
| Studio | Same `/studio`, seven config fields, actual SVG preview, zoom as presentation state, visible save/reset, dirty/save race handling | `apps/web/app/studio/StudioClient.tsx:207`, `apps/web/app/studio/StudioClient.tsx:669`, `apps/web/app/studio/StudioClient.tsx:837` |
| SVG | Pure deterministic 1200×630 document, escaped identity, all live metrics, 4/5-axis radar including zero Craft, heatmap, platforms, seal/sample | `apps/web/lib/render/BadgeSvg.tsx:84`, `apps/web/lib/render/RadarChart.ts:59` |
| Save/cache | Preserve awaited SVG+OG locale invalidation and revision fencing; render variant participates in both image representations | `apps/web/lib/render/badge-svg-cache.ts:86`, `apps/web/lib/render/badge-svg-cache.ts:101`, `apps/web/lib/render/badge-svg-cache.ts:252` |
| Agent tools | Keep actual map, registrations, gates, lifecycle and human-confirmed saves; localize catalog presentation | `apps/web/lib/webmcp/site-tool-map.ts:1`, `apps/web/lib/webmcp/use-model-context-tools.ts:67` |
| Data | No scoring algorithm, confidence visibility, HMAC payload, OAuth scope, user registration or metrics persistence changes | `CLAUDE.md:240`, `docs/decisions/2026-08-30-one-badge-artifact.md:144` |

The author pill remains desktop-visible as today; this work does not silently invent a mobile placement or mount a second terminal in Studio. Meaningful existing green status/archetype/chart colors remain semantic colors, rather than being indiscriminately removed.

## Visual targets within the current token format

These are implementation targets. Contrast checks must measure the actual foreground/background/state combinations; an adjustment required for legibility must retain the approved palette direction and be recorded in phase evidence.

| Role/token | Light | Dark |
| --- | --- | --- |
| `bg`, `warm-bg` | `#F4F0E7` | `#141719` |
| `card`, `warm-card` | `#FFFDF7` | `#202528` |
| `purple-tint`, `hero-band` (badge stage) | `#DCEAF0` | `#192B35` |
| `text-primary` | `#1B1B19` | `#EEEAE1` |
| `text-secondary`, `terminal-dim` | `#64625E` | `#B3B9B9` |
| `amber` (brand fill) | `#ED4930` | `#FF795F` |
| `amber-text` (brand text) | `#AA2D1A` | `#FF927D` |
| `amber-light` | `#F77A62` | `#FF9D88` |
| `amber-dark` | `#AA2D1A` | `#C24E39` |
| `stroke`, `warm-stroke` | `#24232130` | `#EEEAE12B` |
| `stroke-strong` | `#1B1B19` | `#EEEAE15C` |
| `track` | `#1B1B191F` | `#EEEAE121` |
| `dark-section` | `#1B1B19` | `#0D1215` |
| `dark-card` | `#252521` | `#202528` |
| additive `identity-surface` / `identity-text` | `#ED4930` / `#1B1B19` | `#3A2222` / `#EEEAE1` |
| additive `closing-surface` / `closing-text` | `#ED4930` / `#1B1B19` | `#A92F21` / `#F4F0E7` |
| additive `action` / `action-text` | `#1B1B19` / `#F4F0E7` | `#FF795F` / `#17191A` |
| additive `action-hover` | `#AA2D1A` | `#FF9D88` |

The primary action uses the paired action foreground on both normal and hover fills. Small accent text uses `amber-text`, not the fill token. Preserve the slate-blue verification family, semantic status/dimension/archetype roles, measuring them against the new grounds. The fixed terminal family becomes ink (`forest=#1B1B19`, card `#252521`, text `#F4F0E7`, dim `#C2C0B8`, line `#F4F0E750`, grid `#F4F0E70A`); fixed status colors retain their contrast-safe role. Shadows become neutral solid offsets: 3px standard and 5px hover, with smaller/no offsets in dense UI. Prototype reference: `/Users/juan/code/chapa-redesign/theme.css:2`.

Use flat fields, rules, asymmetric desktop composition and restrained square/3px corners. Keep recognizable round avatars, icon buttons and the signature pill. Content text retains the existing 11px floor, with ordinary copy at 14–16px; do not import the prototype's 7–9px content text. Expressive type can scale with `clamp`; Spanish must wrap naturally rather than inherit English line breaks. Typography/legibility baseline: `docs/design-system.md:159`.

## Copy contract

| Placement | English | Spanish |
| --- | --- | --- |
| Hero plain explanation | Turn your development activity across platforms into a profile and badge you can share. | Convierte tu actividad de desarrollo en distintas plataformas en un perfil y una chapa que puedes compartir. |
| Identity narrative | Your work is more than a commit count. | Tu trabajo es más que un recuento de commits. |
| Badge CTA | Open the Creator Studio | Abre el Estudio de Creación |
| Hero expressive heading | GOOD WORK / LEAVES A / MARK_ | EL BUEN TRABAJO / DEJA / HUELLA_ |
| Badge new activity heading | 01 / ACTIVITY | 01 / ACTIVIDAD |
| Badge heatmap caption | 13 WEEKS × 7 DAYS | 13 SEMANAS × 7 DÍAS |
| Badge new impact heading | 02 / IMPACT | 02 / IMPACTO |

Slashes in the expressive hero heading indicate visual line groups. Badge headings retain their literal `01 /` and `02 /` punctuation. Spanish strings are plan-selected equivalents, not a claim of separate user approval; the Studio CTA uses the existing localized product name (`apps/web/lib/i18n/dictionaries/es.ts:1485`). Remaining approved prototype copy is adapted into paired dictionaries in Phase 3. Technical command identifiers, platform brands and existing internal archetype IDs remain stable. Descriptive archetype text must reflect repository semantics rather than invented scoring claims. SAMPLE/Simulated metrics and localized tier come from the real badge string builder.

## Phases and ownership

| Phase | Deliverable | Dependencies |
| --- | --- | --- |
| [1 — Foundation](2026-09-05-chapa-redesign-phases/phase-1.md) | Token/font system, shared component treatment, persistent shell presentation, synced conventions | None |
| [2 — Badge](2026-09-05-chapa-redesign-phases/phase-2.md) | Versioned renderer, Ice default with saved-color compatibility, locale headings, SVG/OG versioning and overlay | 1 |
| [3 — Landing](2026-09-05-chapa-redesign-phases/phase-3.md) | Approved composition, Elite sample, paired copy, explorer/README/commands | 1, 2 |
| [4 — Product surfaces](2026-09-05-chapa-redesign-phases/phase-4.md) | Studio/share/content/verify/settings/admin presentation, brand assets and transitional states | 1–3 |
| [5 — Verification and sync](2026-09-05-chapa-redesign-phases/phase-5.md) | Integrated local evidence, complete documentation, design-sync package/handoff status | 1–4 |

**No phase is `[batch-eligible]`.** Phases share token consumers, dictionaries, Studio option metadata, badge geometry and sync documentation. Phase 3 consumes Phase 2's renderer; Phase 4 reviews the integrated composition; Phase 5 verifies final values. Independent read-only reviews may run in parallel, but implementation phases and verification commands remain sequential.

## Local execution and review rules

1. Before implementation, inspect working tree and local `develop` changes. Preserve unrelated scoring-audit artifacts. Create an isolated worktree on `feature/chapa-redesign` from the reviewed local integration baseline, following `CLAUDE.md:345`; do not pull or push as part of starting this plan. Carry these plan/research artifacts into the worktree explicitly if still untracked.
2. Archive the pinned design references in Phase 1. A missing or changed reference must be reported and resolved from existing artifacts before implementation claims visual fidelity.
3. For behavior/contract changes, use meaningful red→green tests; visual-only styling uses existing interaction coverage and the visual rubric. Never weaken escaping, schema, accessibility, cache or contrast tests to obtain a pass.
4. Each phase: implement → plan-compliance review → fix → reuse/quality/efficiency review (Codex equivalent of `/simplify`) → sequential local verification → present evidence and stop. Approval of the design is not authorization to skip these review gates.
5. At every implementation gate run `pnpm run typecheck`, then `pnpm run lint`, then `pnpm run test`, then `pnpm run build`, plus that phase's targeted/browser checks. Do not run full suites concurrently or run them again on an unchanged state merely to repeat evidence. Phase 5's coverage run can serve as its full test gate.
6. Use a local-only environment with production service credentials absent and necessary feature flags supplied locally. Do not point E2E/journey tests at shared/remote services. Run the DB contract suite only against disposable local Supabase. Confirm the base URL is loopback and the local server belongs to this worktree before browser tests.
7. No pushes/PRs/deployments during implementation gates. Before a later authorized push, inspect current workflow and Vercel Git triggers; `.github/workflows/ci.yml:3` bills pushes/PRs to integration/production. `apps/web/vercel.json:1` does not establish preview suppression. If previews would run, resolve via documented non-destructive configuration before pushing. Production remains `develop`→`main` merge-commit release, separately authorized (`CLAUDE.md:345`).

## Risks, completion and rollback

- **Global tokens affect many routes:** phase-scoped render checks and Phase 4 surface matrix cover normal/error/loading/control states, not just the hero.
- **Badge bytes intentionally change:** preserve the old lock artifact, record new version/hashes, verify SVG and actual PNG glyphs before updating canonical references. Existing font-file tracing remains; app font changes do not remove the badge's bundled Plus Jakarta/JetBrains fonts.
- **Rotated hero + overlay:** hotspot geometry and tooltip anchoring are checked against the transformed badge; preserve 11 screen-reader descriptions and existing non-tabbable hotspot model (`apps/web/components/BadgeOverlay.render.test.tsx:38`).
- **Image caches:** include render variant in OG Redis key and OG metadata version as well as SVG key. Existing browser/CDN caches may still contain responses for unchanged embed URLs; eventual release must verify/purge through the documented authorized release process. Local tests are not evidence of remote cache freshness.
- **External sync tooling:** local format/export verification is required and attainable. Actual converter/contact-sheet/upload/readback is a separate named gate when the existing tool is available; absence is reported as “not executed,” never “passed.” Do not install or invent a replacement sync protocol.
- **Rollback:** prior reviewed commits and `jade-v1` references preserve the baseline. Before release, local changes can be reverted as a coherent unit. After Ice configs have been saved, never roll back to code that rejects `ice`; a rollback must retain the additive palette validator and legacy normalization, restore previous presentation deliberately, and issue a fresh render/cache version. No production rollback or data rewrite is authorized here.

Completion requires all five phase criteria, the acceptance rubric, local checks and honest sync status. This planning turn ends after document review; `/implement` begins Phase 1 in a subsequent turn. No unresolved product questions remain; five focused review gates are the selected cadence, subject to later user steering. Read-only badge, interaction and design-system reviews are recorded in [plan review](2026-09-05-chapa-redesign-phases/plan-review.md).

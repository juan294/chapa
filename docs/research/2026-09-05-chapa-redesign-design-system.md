# Research: approved Chapa redesign and existing product contracts

**Date:** 2026-09-05  
**Phase:** Research only; no implementation plan or application changes.  
**Repository baseline:** `develop`, commit `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d`.  
**Method:** locator, analyzer, pattern-finder and historical-document passes, followed by source cross-checks and focused local tests. The command requires documentary findings, cited sources and a stop after research; source: `.claude/commands/research.md:5` and `CLAUDE.md:320`. Session measurements are recorded in `docs/research/2026-09-05-chapa-redesign-evidence.json:1`.

## 1. Research question and user-provided brief

What currently implements Chapa's visual system and product interactions, and what contracts surround the approved redesign, Studio, localization, signature pill, design-sync and versioned SVG badge?

The following are **user instructions from this research session**, not claims inferred from source code:

1. The approved direction is the current local “Leave a mark / developer's shell” page, with light/dark mode and the Ice Terminal badge revision that removes the decorative `+ PROFILE / …` header.
2. Proceed through a full Research–Plan–Implement cycle, beginning with `/research`; this turn is the research phase.
3. The product remains **Studio** at `/studio`. “Badge lab” names the temporary design-comparison harness, not a product rename or requested production route.
4. Preserve English and Spanish throughout the website, including the visible language picker.
5. Preserve the bottom-right animated author/signature pill and its identity. Its absence from the mockup does not authorize removal.
6. Preserve the existing design-system scheme and file format. Update its elements and visual values to express the approved design; retain code-to-Claude Design synchronization through design-sync.
7. Preserve developer identity and slash-command navigation.
8. Preserve the real SVG badge's data-driven elements and explicit design versioning.
9. Add this exact plain English sentence near the hero alongside the expressive language: **“Turn your development activity across platforms into a profile and badge you can share.”**
10. Retain **“Your work is more than a commit count.”** The user's rationale is that contribution volume matters without representing the whole picture.
11. No Vercel previews or remote compute as a debugging loop; hosted actions and production deployment have separate authorization requirements.
12. The landing's sample badge should display **Elite** instead of **High / 82**, as an inspirational and aspirational example. The user has not specified an exact replacement score.
13. Replace the prototype's “Open the badge lab” CTA with **“Open the Creator Studio”**, using the existing `/studio` product route and localized equivalent. “Creator Studio” is the selected wording from the user's offered Studio alternatives.

These instructions are also recorded as the session brief in `docs/research/2026-09-05-chapa-redesign-evidence.json:1`. The English hero sentence is copy intent captured by this research, not an application edit or an already-completed Spanish translation.

## 2. Approved reference artifacts and their boundaries

The approved prototype is outside the repository at `/Users/juan/code/chapa-redesign`. It records paper/ink/vermilion/ice-blue surfaces, editorial display typography, monospace terminal details, large flat color fields, thin rules and offset shadows. Its typography references Barlow Condensed, Manrope and JetBrains Mono. Source: `/Users/juan/code/chapa-redesign/CONCEPT.md:9`.

| Reference | What it currently contains | Evidence |
| --- | --- | --- |
| Local landing at `http://127.0.0.1:8768/` | Hero, identity story, archetypes, scoring, README, WebMCP, verification and closing CTA | `/Users/juan/code/chapa-redesign/CONCEPT.md:20` |
| Light/dark reference | Paper light mode; charcoal page, navy stages, warm white text, coral emphasis and deeper red sections in dark mode | `/Users/juan/code/chapa-redesign/theme.css:2`, `/Users/juan/code/chapa-redesign/theme.css:14`, `/Users/juan/code/chapa-redesign/theme.css:74` |
| Prototype shell | Local command registry, keyboard interaction and links to existing Chapa routes | `/Users/juan/code/chapa-redesign/shell.js:18`, `/Users/juan/code/chapa-redesign/CONCEPT.md:42` |
| Badge candidate | `ice-terminal-v2-proposal`, derived from `jade-v1`; clean avatar/name/status header with the decorative profile line removed | `/Users/juan/code/chapa-redesign/badge-lab/version.json:3`, `/Users/juan/code/chapa-redesign/badge-lab/PROPOSAL.md:59` |
| SVG comparison harness | Repository fixtures, current/candidate comparison, config controls and SVG download | `/Users/juan/code/chapa-redesign/badge-lab/PROPOSAL.md:37` |
| Candidate badge palette | Navy `#0C141B`, ice `#BAD9E8`, warm-white `#F1EEE7`, secondary `#ABBAC3`; other configured palettes pass through to the existing resolver | `/Users/juan/code/chapa-redesign/badge-lab/proposal-theme.ts:5` |

The prototype uses its own CSS variables, per-theme overrides and `chapa-concept-theme` browser persistence. Production instead uses the shared Tailwind token block and `next-themes` described below. The prototype's `/badge-lab` is a local route, while its `/studio` points to the existing Studio. Sources: `/Users/juan/code/chapa-redesign/theme.js:3`, `/Users/juan/code/chapa-redesign/theme.css:14`, `/Users/juan/code/chapa-redesign/shell.js:21`, `/Users/juan/code/chapa-redesign/shell.js:31`.

The candidate's private adapter maps `jade` to Ice for comparison only; it is explicitly not a persisted-config migration. Its exported SVG and source-baseline hashes are recorded in its version manifest. Sources: `/Users/juan/code/chapa-redesign/badge-lab/proposal-theme.ts:3`, `/Users/juan/code/chapa-redesign/badge-lab/PROPOSAL.md:33`, `/Users/juan/code/chapa-redesign/badge-lab/version.json:5`.

## 3. Current application surface map

| Surface | Existing implementation and behavior | Evidence |
| --- | --- | --- |
| Root document | Next font loading, global styles, skip link, theme/language/feature-flag providers | `apps/web/app/layout.tsx:31`, `apps/web/app/layout.tsx:158`, `apps/web/app/layout.tsx:169` |
| Landing route | Locale-generated server page; `force-static`; hourly revalidation; translated metadata; real demo SVG | `apps/web/app/[locale]/page.tsx:18`, `apps/web/app/[locale]/page.tsx:28`, `apps/web/app/[locale]/page.tsx:40` |
| Landing body | Shared navbar; hero; badge overlay; features; steps; scoring; enterprise CLI; agent catalog; persistent terminal; footer | `apps/web/app/LandingContent.tsx:162`, `apps/web/app/LandingContent.tsx:222`, `apps/web/app/LandingContent.tsx:243`, `apps/web/app/LandingContent.tsx:488` |
| Navigation | Server/client navbar wrappers share `NavbarShell`; language and theme controls are always mounted in its control group | `apps/web/components/NavbarShell.tsx:41`, `apps/web/components/NavbarShell.tsx:83`, `apps/web/components/NavbarShell.tsx:87` |
| Static content | Locale-segmented About, scoring/verification explainers, legal pages and seven archetype guides | `apps/web/proxy.ts:67`, `apps/web/app/[locale]/layout.tsx:15` |
| Content presentation | Shared command-style section heading, content header and section index | `apps/web/components/SectionHeader.tsx:1`, `apps/web/components/content/ContentPageHeader.tsx:1`, `apps/web/components/content/OnThisPageIndex.tsx:27` |
| Dynamic page shell | Locale marker, resolved language provider and server navbar for request-dependent routes | `apps/web/components/DynamicRouteShell.tsx:39`, `apps/web/components/DynamicRouteShell.tsx:46` |
| Studio | Existing `/studio` route; feature/demo/auth gates; actual badge preview, visual controls, session terminal, save/reset | `apps/web/app/studio/page.tsx:30`, `apps/web/app/studio/page.tsx:90`, `apps/web/app/studio/StudioClient.tsx:750`, `apps/web/app/studio/StudioClient.tsx:845` |
| Share page | Actual badge, profile breakdown and progressively disclosed command navigation | `apps/web/app/u/[handle]/page.tsx:161`, `apps/web/components/CommandBarHint.tsx:33` |
| Signature pill | `AuthorTypewriter` at the right side of the fixed global command bar, currently desktop-only through `hidden md:block` | `apps/web/components/GlobalCommandBar.tsx:161` |
| Footer | Provided translator; optional login CTA; Chapa/platform attribution; About, Scoring, Terms and Privacy links; copyright | `apps/web/components/SiteFooter.tsx:51`, `apps/web/components/SiteFooter.tsx:62`, `apps/web/components/SiteFooter.tsx:83`, `apps/web/components/SiteFooter.tsx:104` |
| Settings and admin | Existing request-dependent product surfaces using shared design-system elements | `CLAUDE.md:204`, `CLAUDE.md:205`, `apps/web/components/DynamicRouteShell.tsx:39` |

The existing landing also includes enterprise/EMU information and a CLI transcript, which has its own fixed dark token family. Its agent catalog derives counts and route entries from `SITE_TOOL_MAP`. Sources: `apps/web/app/LandingContent.tsx:373`, `apps/web/app/LandingContent.tsx:409`, `apps/web/app/LandingContent.tsx:31`, `apps/web/app/LandingContent.tsx:432`.

## 4. Design-system format and runtime theme selection

### Token declaration contract

`docs/design-system.md:3` identifies the design document as the visual source of truth. Executable tokens are declared in **one Tailwind v4 `@theme` block**. Each theme-dependent value is a single `light-dark(light, dark)` declaration. Theme selectors set `color-scheme`; they do not contain a second set of color declarations. Sources: `apps/web/styles/globals.css:11`, `apps/web/styles/globals.css:23`, `apps/web/styles/globals.css:147`.

| Token family | Current purpose | Evidence |
| --- | --- | --- |
| `bg`, `card`, `purple-tint`, `dark-section`, `dark-card`, `hero-band` | Page, card and section surfaces | `apps/web/styles/globals.css:24` |
| `warm-*` | Retained aliases for existing consuming utilities | `apps/web/styles/globals.css:35` |
| `text-primary`, `text-secondary`, `terminal-dim` | Text hierarchy and metadata | `apps/web/styles/globals.css:40` |
| `stroke`, `stroke-strong`, `track` | Borders, separators and chart tracks | `apps/web/styles/globals.css:47` |
| `amber*`, including `amber-text` | Brand fill/hover/text roles; names retained through previous palette changes | `apps/web/styles/globals.css:52` |
| `terminal-green/yellow/red` | Success, warning and error semantics | `apps/web/styles/globals.css:66` |
| `complement*` | App verification surfaces, fills and text | `apps/web/styles/globals.css:72` |
| `forest*` | Fixed dark surfaces, text, borders and status colors independent of page theme | `apps/web/styles/globals.css:92` |
| `shadow-card*` | Standard and hover card shadows | `apps/web/styles/globals.css:110` |
| `dimension-*` | Theme-aware dimension visualization colors | `apps/web/styles/globals.css:119` |
| `archetype-*` | Single-value semantic archetype colors | `apps/web/styles/globals.css:131` |
| `font-heading`, `font-body`, `font-terminal` | Heading/body/terminal font bindings | `apps/web/styles/globals.css:141` |

Current font bindings use JetBrains Mono and Plus Jakarta Sans, loaded by Next with named CSS variables. The token naming and paired-value layout are distinct from the approved prototype's standalone CSS format. Sources: `apps/web/app/layout.tsx:31`, `apps/web/styles/globals.css:142`, `/Users/juan/code/chapa-redesign/theme.css:2`.

### Current theme behavior

The actual runtime default is **system**, with explicit light and dark choices. `next-themes` writes `data-theme`; `ThemeToggle` cycles system → light → dark, provides translated next-action labels and reserves space before hydration. Sources: `apps/web/components/ThemeProvider.tsx:13`, `apps/web/components/ThemeProvider.tsx:22`, `apps/web/components/ThemeToggle.tsx:11`, `apps/web/components/ThemeToggle.tsx:26`.

The token-layer ADR records the single-declaration format and the existing LightningCSS transformation path for `light-dark()`. Structural tests enforce this format, fixed-dark behavior and token contrast. Sources: `docs/decisions/2026-08-29-light-dark-token-layer.md:25`, `docs/decisions/2026-08-29-light-dark-token-layer.md:40`, `apps/web/styles/tokens.test.ts:62`, `apps/web/styles/tokens.test.ts:101`.

## 5. Existing code-to-Claude Design synchronization

### Package and component contract

`.design-sync/config.json` identifies the existing project and package contract: `shape: package`, package `@chapa/web`, browser global `Chapa`, package build command, TypeScript config, stable `.ds-styles.css` entry and `.design-sync/conventions.md` header. Sources: `.design-sync/config.json:2`.

The configured component map and `.ds-entry.tsx` barrel expose fifteen components: StatusCallout, ConfirmDialog, LoginCtaButton, ClaudeCodeStar, LiteYouTubeEmbed, InsightCard, Sparkline, five platform/copy icons, SectionHeader, ContentPageHeader and OnThisPageIndex. The entry lives inside `apps/web` for package discovery and explicitly limits the export set. Sources: `.design-sync/config.json:11`, `apps/web/.ds-entry.tsx:3`, `apps/web/.ds-entry.tsx:11`.

The schema also includes manually supplied `dtsPropsFor` and story/viewport overrides. Preview files import real package components. The current section-index component accepts a caller-provided heading, keeping its standalone import path independent of Next/i18n internals. Sources: `.design-sync/config.json:28`, `.design-sync/config.json:45`, `.design-sync/previews/StatusCallout.tsx:1`, `apps/web/components/content/OnThisPageIndex.tsx:27`.

### Recorded export sequence

The repository describes this existing direction:

```text
Application components + globals.css
    → compiled application CSS
    → stable .ds-styles.css + standalone font bindings/safelist
    → external package converter and ds-bundle
    → clean @theme token manifest
    → Claude Design project upload/receipt
```

The package/path behavior is documented in `.design-sync/NOTES.md:65`; stylesheet/font assembly in `.design-sync/NOTES.md:76`; the latest concrete CSS assembly recipe in `.design-sync/NOTES.md:416`; output/upload receipts in `.design-sync/NOTES.md:452`.

`.design-sync/fonts.css` supplies standalone font imports and heading/body/terminal aliases because that environment has no Next font runtime. `.design-sync/safelist.css` includes fixed-dark warning/error utilities. The stylesheet filename stays stable even though the app's compiled CSS chunk filename changes. Sources: `.design-sync/fonts.css:1`, `.design-sync/safelist.css:1`, `.design-sync/NOTES.md:287`.

### Token export behavior

The pure `buildTokenCss()` function extracts custom-property declarations from `@theme`, preserves their values, excludes `--tw-*`, and emits a generated token-only `@theme` manifest. The CLI writes `ds-bundle/tokens/chapa-tokens.css`; it does not remove Tailwind engine variables from the compiled runtime CSS. Sources: `.design-sync/emit-tokens.mjs:4`, `.design-sync/emit-tokens.mjs:21`, `.design-sync/emit-tokens.mjs:34`, `.design-sync/emit-tokens.mjs:53`, `.design-sync/emit-tokens.mjs:80`.

A read-only invocation during this research returned **58 declarations**, an `@theme` block, and no engine-token declarations. The emitter tests also passed. Measurement: `docs/research/2026-09-05-chapa-redesign-evidence.json:1`; implementation/test sources: `.design-sync/emit-tokens.mjs:53`, `scripts/design-sync-emit-tokens.test.ts:33`.

### Recorded sync history and inspection boundary

The latest recorded sync is dated 2026-08-31 and keeps the fifteen-component scope. Its correction states that grading used `sourceKeys`, not `styleSha`; receipt notes record style/auxiliary/bundle hashes and readback comparisons. Deletions follow the converter's explicit `upload.deletePaths`, alongside separately authored design content. These are statements from dated repository notes, not a newly executed remote sync. Sources: `.design-sync/NOTES.md:375`, `.design-sync/NOTES.md:381`, `.design-sync/NOTES.md:452`, `.design-sync/NOTES.md:458`.

Generated bundles, sync state and assembled CSS are gitignored. The current inspection found no `.ds-sync/` or `ds-bundle/` output and no available local design-sync skill/command or exposed sync capability. Research inspected the repo-side format and dated integration notes; it did not inspect current remote Claude Design state or run upload/converter steps. Sources: `.gitignore:93`; session observation: `docs/research/2026-09-05-chapa-redesign-evidence.json:1`.

The conventions explicitly treat the live badge as a separately rendered always-dark SVG rather than a recreated design-system component. Source: `.design-sync/conventions.md:103`.

## 6. Localization and the visible language picker

The supported locale set is `en`/`es`; the actual current fallback is **English**. Both dictionaries and their server mapping already exist. Sources: `apps/web/lib/i18n/types.ts:1`, `apps/web/lib/i18n/types.ts:15`, `apps/web/lib/i18n/server.ts:9`.

The picker presents EN/English and ES/Español. It supports outside-click and Escape dismissal, first-option focus, arrow navigation, Home/End and Enter selection. It calls the existing locale provider and appears in the shared navbar alongside the theme control. Sources: `apps/web/components/LanguageSwitcher.tsx:7`, `apps/web/components/LanguageSwitcher.tsx:21`, `apps/web/components/LanguageSwitcher.tsx:34`, `apps/web/components/LanguageSwitcher.tsx:56`, `apps/web/components/LanguageSwitcher.tsx:64`, `apps/web/components/NavbarShell.tsx:87`.

The server prioritizes a valid query override, cookie, Accept-Language and default locale. Public content URLs are rewritten internally to locale segments; both locale variants are generated, with an exact route matcher that excludes Studio, API and badge hot paths. Sources: `apps/web/lib/i18n/server.ts:11`, `apps/web/proxy.ts:17`, `apps/web/proxy.ts:59`, `apps/web/proxy.ts:67`, `apps/web/app/[locale]/layout.tsx:15`.

Locale changes persist through a server action. The client constructs canonical navigation while preserving search/hash, updates an existing `lang` query and can use an explicit query when persistence fails. The action does not revalidate the static root layout. Sources: `apps/web/lib/i18n/provider.tsx:65`, `apps/web/lib/i18n/provider.tsx:244`, `apps/web/lib/i18n/provider.tsx:277`, `apps/web/lib/i18n/set-locale-action.ts:5`.

Landing content receives its server translator and reads structured dictionary fields for hero title, highlighted text, bullets, CTAs and all subsequent sections. Emphasis within bullet strings uses `**keyword**` markers owned by each translation. Sources: `apps/web/app/[locale]/page.tsx:45`, `apps/web/app/LandingContent.tsx:53`, `apps/web/app/LandingContent.tsx:133`.

Studio is inside the dynamic locale shell; its SVG preview receives translated badge strings. Badge route locale and locale-keyed cache strings are resolved through `resolveBadgeLocale`. Sources: `apps/web/app/studio/page.tsx:57`, `apps/web/app/studio/BadgePreviewCard.tsx:61`, `apps/web/lib/render/badge-locale.ts:48`.

Dictionary parity tests compare both languages and reject empty leaves; Studio tests include preserving configuration/history across locale changes. Sources: `apps/web/lib/i18n/dictionaries/parity.test.ts:43`, `apps/web/app/studio/StudioClient.render.test.tsx:639`.

## 7. Signature pill and command-navigation behavior

`AuthorTypewriter` starts with `</> JG`, cycles through literal messages and returns to the home signature between messages. It types at 80 ms per character, pauses 300 ms between transitions, holds the signature for 30 seconds and messages for four seconds. Sources: `apps/web/components/AuthorTypewriter.tsx:10`, `apps/web/components/AuthorTypewriter.tsx:14`, `apps/web/components/AuthorTypewriter.tsx:63`, `apps/web/components/AuthorTypewriter.tsx:133`.

The pill exposes an author/social popover through hover, focus and persistent button toggle. Its button supports native keyboard activation and has a localized author label. It uses existing heading, accent, card, border and text tokens. The typing loop respects initial reduced-motion preference and cleans up its timer. Sources: `apps/web/components/AuthorTypewriter.tsx:92`, `apps/web/components/AuthorTypewriter.tsx:163`, `apps/web/components/AuthorTypewriter.tsx:175`, `apps/web/components/AuthorTypewriter.tsx:184`, `apps/web/components/AuthorTypewriter.tsx:215`.

Its current mount is inside `GlobalCommandBar` at the right edge, visible from the `md` breakpoint. Landing renders that shared bar through `LandingTerminal` and the lazy wrapper. Sources: `apps/web/components/GlobalCommandBar.tsx:161`, `apps/web/app/LandingTerminal.tsx:7`, `apps/web/components/GlobalCommandBarLazy.tsx:5`.

The global command registry supplies localized, feature-gated commands and the shared parsing/matching/dispatch path. Existing commands include help, home, Studio, login, badge, About, scoring, legal and archetype navigation. Internal routes use `navigateInApp`; OAuth uses a full redirect; action commands dispatch events. Sources: `apps/web/components/terminal/command-registry.ts:221`, `apps/web/components/terminal/command-registry.ts:403`, `apps/web/components/GlobalCommandBar.tsx:62`, `apps/web/components/GlobalCommandBar.tsx:82`.

The input already implements Enter, history arrows, Escape and combobox/autocomplete relationships. The autocomplete listbox and focus shortcut are shared, with locale-independent DOM identifiers. Sources: `apps/web/components/terminal/TerminalInput.tsx:68`, `apps/web/components/terminal/TerminalInput.tsx:149`, `apps/web/components/terminal/AutocompleteDropdown.tsx:115`, `apps/web/lib/keyboard/shortcuts.ts:14`, `apps/web/lib/keyboard/shortcuts.ts:92`.

The share page currently exposes the bar progressively via a hint and keyboard listener; the landing uses a persistent bar. Studio has its own session/tools layout. Sources: `apps/web/components/CommandBarHint.tsx:23`, `apps/web/components/CommandBarHint.tsx:33`, `apps/web/app/LandingContent.tsx:488`, `apps/web/app/studio/StudioClient.tsx:845`.

## 8. Studio's current product and save contract

The canonical route and localized name are `/studio` and Studio/Creator Studio. The route supports an explicitly gated anonymous demo and an authenticated owner mode; it resolves profile, saved config, avatar and verification inputs before rendering. Sources: `apps/web/app/studio/page.tsx:30`, `apps/web/lib/i18n/dictionaries/en.ts:1083`, `apps/web/app/studio/page.tsx:90`, `apps/web/app/studio/page.tsx:118`, `apps/web/app/studio/page.tsx:152`.

The existing layout consists of a full-width preview stage with fit/50%/100% framing, summary/copy controls, followed by Quick Controls and session tools. Save/reset controls are present outside the collapsible Quick Controls. Zoom is presentation state rather than persisted BadgeConfig. Sources: `apps/web/app/studio/StudioClient.tsx:669`, `apps/web/app/studio/StudioClient.tsx:750`, `apps/web/app/studio/StudioClient.tsx:837`, `apps/web/app/studio/StudioClient.tsx:903`, `CLAUDE.md:224`.

`BadgePreviewCard` calls `renderBadgeSvg` with current config, stats, impact, avatar, seal, demo flag and localized strings, then injects that SVG. Studio's seven visual categories are the same categories in the shared BadgeConfig schema. Sources: `apps/web/app/studio/BadgePreviewCard.tsx:61`, `apps/web/app/studio/studio-options.ts:65`, `packages/shared/src/types.ts:288`.

Studio keeps dirty state and a persisted snapshot, with an unsaved-navigation guard. Demo saves remain local; owner saves PUT config JSON and distinguish the saved snapshot from edits made during a request. Sources: `apps/web/app/studio/StudioClient.tsx:207`, `apps/web/app/studio/StudioClient.tsx:350`, `apps/web/app/studio/StudioClient.tsx:376`, `apps/web/app/studio/StudioClient.tsx:391`.

The API validates the existing exact schema after stripping retired fields, rate-limits and serializes saves, writes Supabase, awaits rendered-image invalidation and returns `badgeRefreshed`. Shared invalidation covers SVG/OG entries across locales and their edge tags. Sources: `apps/web/app/api/studio/config/route.ts:89`, `apps/web/app/api/studio/config/route.ts:109`, `apps/web/app/api/studio/config/route.ts:123`, `apps/web/app/api/studio/config/route.ts:149`, `apps/web/app/api/studio/config/route.ts:176`, `apps/web/lib/render/badge-svg-cache.ts:252`.

## 9. Badge artifact, versioning and geometric dependencies

### Current landing sample and requested presentation

The landing renders the shared `DEMO_STATS`/`DEMO_IMPACT` fixture with `demoMode: true` and branding enabled; the same impact object also feeds its explanatory overlay. The fixture currently contains `adjustedComposite: 82` and `tier: "High"`. The anonymous Studio demo consumes the same fixture. Sources: `apps/web/app/[locale]/page.tsx:40`, `apps/web/app/[locale]/page.tsx:67`, `apps/web/lib/render/demoData.ts:73`, `apps/web/lib/render/demoData.ts:87`, `apps/web/app/studio/page.tsx:99`.

The current scoring helper defines **Elite at 85 or above** and derives tier from adjusted score in the production pipeline. This records the existing score/label relationship surrounding the user's requested Elite sample; no scoring threshold or fixture changed during research. Sources: `apps/web/lib/impact/utils.ts:253`, `apps/web/lib/impact/utils.ts:258`, `apps/web/lib/impact/v6.ts:380`; requested presentation: `docs/research/2026-09-05-chapa-redesign-evidence.json:1`.

The prototype's hero currently links to `badge-lab/` and shows “OPEN THE BADGE LAB”; its image description names score 82. The existing product dictionary already calls the destination “Creator Studio,” and the product route is `/studio`. These are distinct from the temporary comparison harness and from the newly requested CTA wording recorded above. Sources: `/Users/juan/code/chapa-redesign/index.html:10`, `apps/web/lib/i18n/dictionaries/en.ts:1090`, `apps/web/app/studio/page.tsx:30`.

### Live artifact and design locks

The current renderer is a pure function of stats, impact and options, returning a 1200×630 SVG. Page theme does not select a light badge. Theme colors are literal, raster-compatible values resolved from configuration, and the renderer owns its escaping boundary. Sources: `apps/web/lib/render/BadgeSvg.tsx:27`, `apps/web/lib/render/BadgeSvg.tsx:69`, `apps/web/lib/render/BadgeSvg.tsx:89`, `apps/web/lib/render/theme.ts:27`.

| Live element | Existing input/behavior | Evidence |
| --- | --- | --- |
| Identity | Display name or handle fallback; inline avatar or shield; metric provenance | `apps/web/lib/render/BadgeSvg.tsx:96`, `apps/web/lib/render/BadgeSvg.tsx:293` |
| Archetype and repository metrics | Archetype plus Repos, Watch, Fork and Star; compact formatting | `apps/web/lib/render/BadgeSvg.tsx:134` |
| Activity | Latest 91 days, 13×7 grid; short data zero-filled; five count buckets | `apps/web/lib/render/heatmap.ts:81`, `apps/web/lib/render/theme.ts:210` |
| Radar | Four core axes; optional Craft adds the fifth, including Craft=0; empty-data marker | `apps/web/lib/render/RadarChart.ts:59`, `apps/web/lib/render/RadarChart.ts:131` |
| Score | Adjusted composite, proportional ring, tier and optional treatment | `apps/web/lib/render/BadgeSvg.tsx:192` |
| Platform branding | Connected-platform logos in canonical order; demo all-platform set; optional branding | `apps/web/lib/render/BadgeSvg.tsx:226`, `apps/web/lib/render/BadgeBranding.tsx:30` |
| Verification | Hash/date-backed status and link; distinct sample strip for demo | `apps/web/lib/render/BadgeSvg.tsx:233`, `apps/web/lib/render/VerificationStrip.ts:19` |
| Customization | All seven BadgeConfig categories reach SVG effects/palette | `packages/shared/src/types.ts:314`, `apps/web/lib/render/BadgeSvg.tsx:104` |
| Accessibility and motion | Static/embedded accessible title/description, reduced-motion pulse treatment, animation-disabled path | `apps/web/lib/render/BadgeSvg.tsx:246`, `apps/web/lib/render/BadgeSvg.tsx:274`, `apps/web/lib/render/badge-effects.test.ts:98` |
| PNG | Resvg and explicit bundled font files, with static-animation stripping | `apps/web/lib/render/svg-to-png.ts:8`, `apps/web/lib/render/svg-to-png.ts:46`, `apps/web/lib/render/font-files.ts:45` |

The production render variant is **`jade-v1`**. Tests pin hash and byte length for plain, demo and animation-disabled output, including omitted versus explicit default config. Cache keys include handle, render variant, date and locale. Sources: `apps/web/lib/render/badge-render-variant.ts:8`, `apps/web/lib/render/badge-effects.test.ts:21`, `apps/web/lib/render/badge-effects.test.ts:44`, `apps/web/lib/render/badge-svg-cache.ts:86`.

The published design-version rule is separate from per-user configuration revisions: an intentional design-element change receives a new global render variant. Styling is outside the stats/impact/date verification seal. Sources: `docs/decisions/2026-08-30-one-badge-artifact.md:99`, `docs/decisions/2026-08-30-one-badge-artifact.md:144`.

The badge's five configured palettes include both accent and ground. Its archetype colors are palette-independent; its verification color is fixed coral. The app's verification token family is separately slate blue. Sources: `apps/web/lib/render/theme.ts:69`, `apps/web/lib/render/theme.ts:86`, `apps/web/lib/render/theme.ts:133`, `apps/web/styles/globals.css:72`.

There is an existing geometry consumer outside the SVG: **BadgeOverlay** defines percentage hotspots and leader lines in the badge's 1200×630 coordinate space. Its tooltips/labels are localized and its structure supports focus/tap/hover. Landing mounts it over the inline SVG. Sources: `apps/web/components/BadgeOverlay.tsx:24`, `apps/web/components/BadgeOverlay.tsx:48`, `apps/web/components/BadgeOverlay.tsx:350`, `apps/web/components/BadgeOverlay.tsx:430`, `apps/web/app/LandingContent.tsx:238`.

## 10. WebMCP and existing agent-facing surfaces

The published tool map covers landing, Studio/demo Studio, share and verification. Studio's stated workflow includes human-confirmed saves. The landing derives its visible tool catalog from that map and registers its discovery tools behind the client feature flag. Sources: `apps/web/lib/webmcp/site-tool-map.ts:1`, `apps/web/lib/webmcp/site-tool-map.ts:8`, `apps/web/app/LandingContent.tsx:432`, `apps/web/components/LandingWebMcpTools.tsx:23`.

The adapter owns `document.modelContext`, registers with lifecycle/abort handling and cleans up on unmount. A test compares the published map with the four actual registration surfaces. Sources: `apps/web/lib/webmcp/use-model-context-tools.ts:67`, `apps/web/lib/webmcp/site-tool-map.test.ts:86`.

## 11. Relevant historical decisions

| Date/document | Recorded decision and temporal context | Evidence |
| --- | --- | --- |
| 2026-05-02 i18n plan | English/Spanish picker, persisted choice, keyboard/ARIA and parity checks; its original scope excluded Studio/SVG, which now have localization paths | `docs/plans/2026-05-02-language-picker-i18n.md:11`, `docs/plans/2026-05-02-language-picker-i18n.md:39`, `apps/web/app/studio/page.tsx:57`, `apps/web/lib/render/badge-locale.ts:48` |
| 2026-06-20 terminal ADR | Updated status records accepted progressive disclosure on share pages while preserving the terminal identity | `docs/decisions/2026-06-20-terminal-metaphor-escape-hatch.md:4`, `docs/decisions/2026-06-20-terminal-metaphor-escape-hatch.md:13` |
| 2026-07-15 locale routing ADR | Static locale variants behind exact canonical-path rewrites, separate from auth and badge hot paths | `docs/decisions/2026-07-15-i18n-middleware-carve-out.md:31`, `docs/decisions/2026-07-15-i18n-middleware-carve-out.md:71` |
| 2026-08-29 token-layer ADR | Single paired token declarations, separate color-scheme selectors and existing CSS compilation behavior | `docs/decisions/2026-08-29-light-dark-token-layer.md:25` |
| 2026-08-30 one-artifact ADR | Single renderer; retired non-SVG configuration categories; purity, escaping, fixed dark rendering and static-frame invariants | `docs/decisions/2026-08-30-one-badge-artifact.md:28`, `docs/decisions/2026-08-30-one-badge-artifact.md:60`, `docs/decisions/2026-08-30-one-badge-artifact.md:75` |
| 2026-08-31 sync notes | Fifteen-component scope; source-key grading correction; upload/readback receipts and explicit deletion scope | `.design-sync/NOTES.md:375`, `.design-sync/NOTES.md:381`, `.design-sync/NOTES.md:452` |
| 2026-09-01 cache ADR | Awaited user-visible save invalidation, per-handle edge tags and badge refresh feedback; current helper covers both SVG and OG | `docs/decisions/2026-09-01-badge-edge-cache-purge.md:48`, `docs/decisions/2026-09-01-badge-edge-cache-purge.md:106`, `apps/web/lib/render/badge-svg-cache.ts:252` |

Historical names/defaults describe their recorded period: the current source says system theme, English fallback, seven BadgeConfig fields and `jade-v1`. Sources: `apps/web/components/ThemeProvider.tsx:22`, `apps/web/lib/i18n/types.ts:15`, `packages/shared/src/types.ts:288`, `apps/web/lib/render/badge-render-variant.ts:8`.

## 12. Existing verification and research measurements

| Area | Existing checks |
| --- | --- |
| Token shape/export | `apps/web/styles/tokens.test.ts:62`; `scripts/design-sync-emit-tokens.test.ts:33` |
| Theme runtime/persistence | `apps/web/components/ThemeProvider.render.test.tsx:49`; `apps/web/components/ThemeToggle.test.tsx:58`; `apps/web/e2e/theme.spec.ts:3` |
| Navbar controls | `apps/web/components/NavbarShell.render.test.tsx:160`; `apps/web/components/MobileNav.render.test.tsx:77` |
| Signature interaction/motion | `apps/web/components/AuthorTypewriter.test.tsx:74`; `apps/web/components/AuthorTypewriter.test.tsx:154` |
| Locale parity/state | `apps/web/lib/i18n/dictionaries/parity.test.ts:43`; `apps/web/app/studio/StudioClient.render.test.tsx:639` |
| Terminal | `apps/web/components/GlobalCommandBar.render.test.tsx:101` |
| Studio artifact/save/layout | `apps/web/app/studio/BadgePreviewCard.render.test.tsx:70`; `apps/web/app/studio/StudioClient.render.test.tsx:412`; `apps/web/app/studio/StudioClient.render.test.tsx:878` |
| SVG version/effects/palettes | `apps/web/lib/render/badge-effects.test.ts:21`; `apps/web/lib/render/badge-palette.test.ts:76`; `apps/web/lib/render/BadgeSvg.test.tsx:1` |
| WebMCP lifecycle/map | `apps/web/lib/webmcp/site-tool-map.test.ts:86`; `apps/web/lib/webmcp/use-model-context-tools.test.ts:1` |

During **this research phase**, seven focused test files passed: **150 tests**, covering token format/emission, themes, navbar controls, signature behavior and dictionary parity. A separate pure emitter invocation returned 58 tokens without writing a bundle. Exact commands/results: `docs/research/2026-09-05-chapa-redesign-evidence.json:1`.

The earlier prototype phase separately recorded 63 renderer scenarios, 205 existing badge tests and 1200px/600px raster output. Those are prior prototype evidence, not a claim that this research ran a full application build or full end-to-end suite. Source: `/Users/juan/code/chapa-redesign/badge-lab/PROPOSAL.md:41`.

The repo defines local typecheck, lint, unit tests, build and E2E commands. CI listens to pushes and pull requests targeting `develop`/`main`; none were triggered here. Sources: `package.json:6`, `apps/web/package.json:6`, `.github/workflows/ci.yml:3`.

## 13. Research boundary

This document records the approved visual/copy brief, existing implementation, integration format, historical decisions and verification seams. No production design tokens, application components, translations, Studio settings, badge defaults or version locks were edited. No remote sync, push, hosted CI or deployment was performed. The repository outputs authored for this redesign research are this document and its evidence record; unrelated workspace files were left untouched. The phase ends here as required by `.claude/commands/research.md:13` and `CLAUDE.md:320`.

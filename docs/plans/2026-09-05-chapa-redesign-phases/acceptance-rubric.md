# Chapa redesign acceptance rubric

This is a checkable implementation contract, not evidence that checks have run. Parent: [plan](../2026-09-05-chapa-redesign.md). Approved source hashes: [reference manifest](reference-manifest.json).

## Visual identity

1. The page uses large paper/charcoal, vermilion and ice fields, asymmetric composition, a prominent real SVG artifact, thin neutral rules and restrained solid shadows.
2. The developer identity remains visible in wordmark, prompts, command labels, terminal output and technical headings through JetBrains Mono. Barlow Condensed is selective expressive display; Manrope is body/UI. The result must not be merely the old page recolored.
3. The persistent command dock works; it is not a decorative screenshot. The signature pill retains `</> JG`, pill silhouette, animation/popover and right-edge desktop presence.
4. System/light/dark use one provider; both themes are deliberate compositions. Badge palette remains independent of page theme.
5. English and Spanish read naturally, with visible language controls and no cramped English-specific line breaks.

## Required page matrix

| Surface | Locales | Themes | Widths/states |
| --- | --- | --- | --- |
| Landing | EN, ES | light, dark; system preference smoke | 1440px, 768px, 390px, 320px reflow |
| Studio demo | EN, ES | light, dark | 1440px, 390px; fit/50%/100%, controls expanded/collapsed |
| Studio owner | EN, ES | light, dark | local fixture: dirty/saved/error/reset/edits-during-save |
| Share/profile | EN, ES | light, dark | desktop/mobile; owner/visitor, sample/real-shaped local fixtures |
| About/scoring/verification explainer | EN, ES | light, dark | desktop/mobile; sticky index and long text |
| Archetype guide | EN, ES | light, dark | representative long label; links to `/#features`; all7route smoke |
| Verify and detail | EN, ES | light, dark | valid/invalid/local sample states; distinct trust semantics |
| Settings/admin | EN, ES | light, dark | authenticated local fixtures; narrow and dense content |
| Privacy/terms | EN, ES | light, dark | long-form reflow and footer |
| Generating/CLI authorize/coming-soon | EN, ES | light, dark | normal/local error state |
| Global/loading/error/not-found | EN, ES where supported | light, dark | keyboard focus and retry/navigation |

Capture a representative screenshot per required combination; inspect all routes functionally without requiring redundant snapshots of identical shared chrome. Use local test fixtures for authenticated/data-dependent views. Record a missing fixture or unexecuted case as incomplete, not passed.

## Functional journeys

- Open `/` with no stored theme; use picker then `/theme` to change themes; reload and confirm same stored choice. Switch back to system and emulate opposite OS preference.
- Change EN→ES→EN with a hash/query present; preserve canonical route, relevant search/hash and translated content. Check hero explanation, Studio CTA, tool descriptions, badge headings, help/output and accessible labels.
- Focus shell with `/` and Cmd/Ctrl+K; navigate suggestions by arrows; Tab fills; Enter executes; Escape dismisses; history works when suggestions are closed. Typing in another field does not steal slash. Studio has one working mod+K owner.
- Read `/help`; reach archetypes, dimensions, README, agent catalog, verification and Studio using actual documented commands. Existing global route commands remain unchanged.
- Navigate all seven explorer tabs by keyboard; open/close dimension details; copy embed through pointer and command, including denied clipboard. Focus indicator and live feedback remain visible.
- Observe signature home/message cycle and social popover by pointer/keyboard. Reduced motion stops typing; no duplicate mounts or footer/dock overlap.
- Change all seven Studio categories, including Ice and saved Jade; inspect live preview, zoom, copy config, save/reset and unsaved navigation. Agent edits require human confirmation to save.
- Confirm the actual WebMCP map/registrations remain feature-gated and lifecycle-owned; catalog descriptions translate without changing machine tool names.

## Badge matrix

- Default Ice, each of five existing palettes, all seven archetypes, optional Craft absent/zero/present, all-zero/short heatmap, high metric counts, long/missing/escaped identity, avatar/shield, branding on/off, each connected-platform combination, sample and hash/date verification.
- All seven config categories reach actual SVG; test each available option at least once with baseline coverage and paired combinations for geometry-sensitive effects.
- Header has avatar/name/provenance with no `+ PROFILE / …` line. Live metric row, activity grid, radar, adjusted-score ring/tier, platforms and seal/disclosure are preserved.
- Landing is 92/Elite everywhere and visibly simulated; shared demo fixture stays unchanged. No verification hash is fabricated.
- Hero tooltip targets align on angled badge, including touch and screen-reader descriptions. Hotspots retain their current non-tabbable accessible model.
- Inline animated and static `<img>`/PNG versions remain complete; rasterize at 1200 and 600px using actual bundled font files. Existing glyph-negative control still fails when glyphs are removed.
- Page theme never changes serialized BadgeConfig, rendered badge palette or HMAC inputs. New global render version and both image caches are consistent.

## Legibility and accessibility

- Normal text meets 4.5:1, large text 3:1, meaningful graphical/control boundaries 3:1. Measure alpha-bearing fills on actual backdrops and normal/hover/selected/focus states; do not test obsolete green surfaces.
- Content text respects the current 11px floor and ordinary copy remains comfortably readable. Preserve 44px existing touch controls. Meaningful content cannot be justified as decorative to avoid the floor.
- No page-width overflow at 320/390px; intentionally scrolling Studio preview/table is bounded and discoverable. Check 200% zoom and 320px reflow.
- Focus is visible and unobscured by fixed nav/dock; landmarks, heading order, accessible names, tab/listbox semantics and copy status survive.
- Reduced motion disables nonessential continuous/reveal effects without hiding badge data; sample and verification text remain readable.
- Color is accompanied by labels/icons for status and tier; successful/error/verified states stay understandable without relying on hue alone.

## Evidence record

For each phase report: reviewed commit/diff hash, check commands and exit statuses, local server/fixture scope, screenshot/export paths, visual deviations and their resolution, and any unexecuted gate. Record design-sync separately as source/config validation, CSS/token output, standalone15component review, converter, upload and readback. Never summarize unexecuted remote steps as passed.

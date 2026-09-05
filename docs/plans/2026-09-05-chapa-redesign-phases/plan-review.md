# Planning review — Chapa redesign

Date: 2026-09-05. This records review of the plan, not implementation verification.

## Review scope

Three read-only passes reviewed the parent plan, relevant phase files and acceptance rubric: badge/config/cache/raster; landing/commands/localization/product behavior; and tokens/fonts/design-sync. The primary agent cross-checked source paths, referenced test files, reference hashes and phase dependencies.

## Material findings resolved in the plan

| Finding | Resolution |
| --- | --- |
| App font replacement could remove browser availability of the SVG's Plus Jakarta face even if raster TTFs remain | Phase 1 retains browser-loadable badge fonts and checks literal family resolution; Phase 2 verifies browser and raster independently |
| Curated high dimensions imply Balanced, rather than the shared demo's Builder archetype | Phase 3 derives the sample archetype with existing `deriveArchetype`; score92/tier uses existing `getTier`; shared demo untouched |
| Preserving `/about` and `/scoring` routes left some landing sections without a command | Phase 3 adds a fixed `/section <id>` map, while keeping global route semantics |
| Scoped command composition was not explicitly forwarded through the lazy terminal wrapper | Phase 3 owns `GlobalCommandBarLazy`/`LandingTerminal` client bridge and serializable server boundary |
| Early-return smoke tests and `__chapa_smoke` cannot prove data-rich page fidelity | Phase 4 creates a named local fixture/bootstrap and test-only upstream preload; Phase 5 reuses it and requires unconditional content assertions |
| New Spanish Studio CTA differed from the existing localized product name | Copy contract now uses “Abre el Estudio de Creación” |
| Standalone component review needed a runnable alternative when converter is unavailable | Phase 5 specifies an ignored local Vite gallery using real exports/previews and assembled CSS/fonts |
| Token presence alone cannot prove utility or font delivery | Phase 1/5 explicitly check compiled font-display and loaded families; all convention-named utilities must exist in assembled CSS |
| Hero visual line notation could be misread as removal of badge heading punctuation | Parent distinguishes hero line groups from literal numbered SVG headings |

## Review conclusion

The plan has five sequential gates and no unresolved product decisions. It preserves the existing design-system schema, fifteen-component sync scope, seven-field BadgeConfig, saved palette semantics, versioned single SVG, locale/theme controls, developer commands, signature pill and current product flows. No phase is batch-eligible because of dependencies and overlapping files.

No implementation tests, app builds, converter/upload steps, pushes or deployments were performed during planning. The research's 150 passing tests are historical baseline evidence only. Local integration and remote sync have separate completion labels; unexecuted gates cannot be reported as passed.

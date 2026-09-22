# Phase 1 local implementation evidence

Date: 2026-09-05. Baseline: `c1ce31cbf5969ee400c4cf232d67cf7dc1b1de0d`.
Implementation staged diff SHA-256 (apps/packages/scripts/sync/CLAUDE/design-system): `2b710462744d8a74ca92035770ecb8f372c890e4f7986904a2b8f3074e915c00`.

| Gate | Result |
| --- | --- |
| Plan compliance review | Approved after fixed-terminal focus and manual Insight metadata fixes |
| Reuse / quality / efficiency reviews | All clear |
| `pnpm run typecheck` | Exit 0, web/shared/scripts |
| `pnpm run lint` | Exit 0, web/shared/scripts |
| `pnpm run test` | Exit 0, 512 files / 8,493 tests |
| `pnpm run build` | Exit 0, local Next production build, EN/ES remain static |
| Playwright theme.spec.ts, chromium + mobile, workers=1 | Exit 0, 8 tests |
| Browser font/reflow capture | Exit 0, eight EN/ES × light/dark × 1440/390 cases |
| Sync source/config | 15/15 exports and manual metadata preserved; five new convention utilities present in compiled CSS |

Runtime: Node 24.19.0, installed pnpm 10.29.2; loopback `127.0.0.1:3001`,
server cwd in the implementation worktree's `apps/web`. Build/server credentials
are local placeholders; hosted service credentials and env files are absent.
Unit tests use unset feature flags, matching suite defaults. Raw logs are local
ignored `logs/redesign/phase1-*`; this report records their final exits.

[Browser measurements](browser.json) record loaded literal Plus Jakarta Sans /
JetBrains Mono and semantic Manrope / Barlow families in every matrix cell.
Next's literal family output makes duplicate browser TTF copies unnecessary;
original bundled raster fonts remain. All eight adjacent PNGs were inspected:
nav and language/theme controls fit, the signature remains a right-edge pill,
and the ink dock reserves content space. Phase 3 owns the new landing composition;
these screenshots deliberately show the existing body on the new foundation.

Actual-surface contrast covers normal, hover, selected/tinted status and nested
icon fills plus meaningful boundaries. Contrast-driven status/complement and
stroke adjustments are recorded in `2026-09-05-chapa-redesign-notes.md`; no
escaping, behavior, theme, or token-shape guard was weakened.

All 13 approved reference hashes match the archived sources. Three production
Jade SVGs also match their historical byte/hash locks and retain the old PNG.

Standalone full-gallery, converter, upload and readback are Phase 5 gates and
have not run here. No push, PR, hosted CI, deployment, or remote data write.

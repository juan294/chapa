# Documentation Update Report

> Generated on 2026-08-26 | Branch: `docs/update-studio-revival` | Changes since `v2.22.1`

## Summary

- 11 documentation files updated
- 1 architecture diagram source and its PNG export refreshed
- 8 version or release-baseline references corrected
- 1 inline JSDoc block updated
- 0 items flagged `[NEEDS REVIEW]`

## Release boundary

Production release `v2.22.1` points to `28437a6e`, whose tree matches the
`develop` reconciliation commit `b513861f`. The documented change window is
therefore `b513861f..e3a384ef`, not an ancestry-derived tag range. It covers the
Creator Studio revival and the Wave 2 remediation merges through PR #1160.

## Changes by file

### Product and architecture

- `CHANGELOG.md` documents truthful owner-data preview, durable Studio config
  fallback and write ordering, localized and accessible save controls, preview
  state preservation, shared badge metadata, operational TypeScript gates, and
  production-identity release baselines. The Unreleased comparison now starts
  at `v2.23.0`, the `v2.23.0` release link is present, and the missing `v2.22.1`
  link definition is restored.
- `CLAUDE.md` now identifies the Studio UI, config API and storage ownership,
  shared client-safe badge metadata, and the boundary between saved Studio
  configuration and the unchanged public badge and share page.
- `docs/chapa-architecture.drawio` now includes `/api/studio/config` among the
  authenticated endpoints. `docs/chapa-architecture.drawio.png` was regenerated
  from that source and checked visually.

### Badge rendering and verification

- `docs/badge-design-v1.md` describes the complete Studio preview composition:
  `BadgeContent`, `BadgePreviewCard`, and `PreviewFooter`. It documents canonical
  platform order, environment-derived host branding, optional verification,
  responsive layout, and the legacy `showFooter` fallback.
- `docs/svg-design.md`, `docs/badge-svg-spec-v1.2.md`, and
  `docs/badge-verification.md` identify `badge-visual-metadata.ts` as the shared
  owner of platform logo paths, platform ordering, and verification coral. The
  SVG spec also corrects the demo platform count from three to four.
- `apps/web/lib/render/BadgeBranding.tsx` now lists platforms in canonical order
  in its existing JSDoc: GitHub, Bitbucket, Codeberg, GitLab.

### Release, CLI, and dependency references

- `docs/playbooks/e2e-pro-release-verification.md` and
  `quality/evidence/README.md` use `v2.22.1` in release-preparation examples.
- `docs/cli-guide.md` uses the published `chapa-cli` version `0.5.0`, nvm
  `v0.40.7`, and Node.js 20.
- `LICENSE-THIRD-PARTY.md` records installed
  `@img/sharp-libvips-darwin-arm64` version `1.3.2`.
- `docs/agents/remediation-report.md` records PRs #1158 and #1160 as merged,
  names exact final commit `e3a384efc8e37da2367aee2b0d0bb5f67afaf0bc`,
  and records all six GitHub Actions workflows plus cleanup as complete.

## Checked and already current

- `README.md` accurately limits config persistence to Creator Studio.
- `docs/demo.md` accurately demonstrates live Studio save behavior without
  claiming that saved configuration changes the public badge.
- `docs/spec.md` and `docs/user-manual.md` already state the same product
  boundary.
- Historical research, plan, phase, pre-launch, release, and rollback records
  remain unchanged because they describe completed decisions or evidence.

## Verification

- `pnpm run lint`: passed.
- `pnpm release:validate-docs`: passed.
- `git diff --check`: passed.
- `xmllint --noout docs/chapa-architecture.drawio`: passed.
- draw.io PNG export: passed; the regenerated 1244 by 1211 image was reviewed
  at original resolution with no overlap or unreadable label.
- `npm view chapa-cli version`: returned `0.5.0`.
- `pnpm list -r @img/sharp-libvips-darwin-arm64 --depth 10`: confirmed `1.3.2`.
- Changed-line structural markdown check: 0 introduced issues after excluding
  MD013, MD024, and MD060, which conflict with established line, changelog, and
  table formatting in these files.

## Markdownlint baseline

The workflow's exact command does not pass:

```sh
npx markdownlint '**/*.md' --ignore node_modules --ignore .claude
```

It exits 1 and traverses nested workspace dependency paths such as
`apps/web/node_modules/` and `packages/shared/node_modules/` because the single
`node_modules` ignore does not exclude nested directories. It also reports
existing MD013, MD024, MD060, and other formatting violations across tracked
documents. The repository has no markdownlint configuration, and resolving
that existing repository-wide lint baseline is outside this documentation
refresh. The updated content follows each file's established format and adds no
new structural violation.

## Flagged for review

None.

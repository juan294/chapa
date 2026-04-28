---
phase: 12A
release: v2.12.0
issues: ["#531"]
batch_eligible: false
effort: M
---

# Phase 12A — ESLint 10 migration (`#531`)

## Goal

Migrate from ESLint 9 (currently `^9.39.0`) to ESLint 10 (currently
`^10.2.1`). ESLint 9 entered maintenance; ESLint 10 is the new default.

This phase MUST run first in v2.12.0 because ESLint 10 may surface new
rule violations across the codebase that need fixing before subsequent
phases can lint-pass.

## Migration steps

1. **Bump versions** in `apps/web/package.json`:
   ```diff
   -    "eslint": "^9.39.0",
   +    "eslint": "^10.2.1",
   -    "eslint-config-next": "^16.2.4",
   +    "eslint-config-next": "^16.2.4",  // verify it supports ESLint 10
   ```
   If `eslint-config-next` is not yet ESLint 10–compatible, pin it to its
   latest 10-compatible version per `npm view eslint-config-next versions`.

2. **Run lint** with `--max-warnings 0` to surface every regression:
   ```bash
   pnpm --filter @chapa/web run lint -- --max-warnings 0
   ```

3. **Address violations** in this phase (do NOT defer to other phases):
   - Common ESLint 10 changes: stricter `no-unused-vars` defaults,
     additional `no-misleading-character-class` matches, etc.
   - For genuine new violations: fix the code.
   - For false positives: add a targeted disable with a comment
     explaining why.

4. **Update flat-config** if needed: ESLint 10 promotes flat config as
   the default. If `apps/web/eslint.config.*` is still legacy, migrate.

5. **Update CI workflow** if the lint step has any version-pinning.

## Risk mitigation

- ESLint 10 may break the editor integration (e.g., VS Code `eslint`
  extension lag). Acceptable — the CI gate is what matters.
- If `eslint-config-next@^16.2.4` is incompatible with ESLint 10, accept
  using a compatible patch and document in `docs/accepted-risks.md`.
- If a critical lint rule changes behavior in a way that affects code
  patterns elsewhere in the codebase, make THAT fix in this phase too.

## Files

- Modified: `apps/web/package.json` — bump `eslint`, possibly `eslint-config-next`
- Modified: `apps/web/eslint.config.*` (or legacy `.eslintrc.*`) — migrate
  to flat config if not already
- Modified: any source files where ESLint 10 surfaces a violation
- Modified: `pnpm-lock.yaml` (auto)
- Updated: `docs/accepted-risks.md` if any compatibility caveats applied

## Acceptance criteria

### Automated
- [ ] `pnpm --filter @chapa/web run lint --max-warnings 0` exits 0
- [ ] `pnpm run typecheck && pnpm run test` pass
- [ ] CI lint step still uses the workspace ESLint resolution and passes
- [ ] `npm view eslint version` matches installed major

### Manual
- Vercel preview build succeeds
- Editor integration (your local VS Code) shows lint errors live again

## Closing the issue

```bash
gh issue close 531 --comment "Fixed in <sha>. ESLint 10 (<exact-version>) adopted; flat config in place; --max-warnings 0 enforced in CI."
```

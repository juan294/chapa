# Phase 3: Integration Tests and Visual Verification

> **Scope:** End-to-end verification that both changes work together and the badge renders correctly in all scenarios

## Changes

### 1. Integration test: full badge render scenarios

**File:** `apps/web/lib/render/BadgeSvg.test.ts` (or create if needed)

**Test matrix:**

| Scenario | Avatar | Platforms | Demo | Expected avatar | Expected footer |
|----------|--------|-----------|------|-----------------|-----------------|
| New user, no photo | undefined | `["github"]` (implicit) | false | Chapa shield | "Built from your commitment" + GH logo |
| User with photo | data URI | `["github"]` | false | User photo | "Built from your commitment" + GH logo |
| User + Bitbucket | undefined | `["bitbucket"]` | false | Chapa shield | Text + GH + BB logos |
| User + all platforms | data URI | `["bitbucket", "codeberg"]` | false | User photo | Text + GH + BB + CB logos |
| Demo badge | undefined | undefined | true | Chapa shield | Text + all 3 logos |
| Branding disabled | undefined | `["github"]` | false | Chapa shield | Empty (no footer) |

### 2. Update design system documentation

**File:** `docs/svg-design.md` (if it references GitHub branding)

Update any references to:
- "Powered by GitHub" → "Built from your commitment"
- GitHub Octocat avatar placeholder → Chapa shield
- `includeGithubBranding` → `includeBranding`

### 3. Update CLAUDE.md if needed

**File:** `CLAUDE.md`

Check the "GitHub branding" section:
```
## GitHub branding
Include GitHub logo and "Powered by GitHub" text.
Must be easy to swap/remove:
- Branding is behind a flag: `includeGithubBranding`
- Branding is isolated in one component/file.
```

Update to reflect:
- Multi-platform branding with dynamic logos
- Flag renamed to `includeBranding`
- Component renamed to `BadgeBranding.tsx`
- Text: "Built from your commitment"

## Verification

```bash
# Full test suite
pnpm run test 2>&1

# Type check
pnpm run typecheck 2>&1

# Lint
pnpm run lint 2>&1

# Dead code check (ensure GithubBranding.tsx is fully removed)
pnpm dlx knip 2>&1
```

## Checklist

- [x] All integration test scenarios pass
- [x] `docs/svg-design.md` updated (if applicable)
- [x] `CLAUDE.md` GitHub branding section updated
- [x] No dead code (old file references cleaned up)
- [x] Full CI-equivalent checks pass locally
- [ ] Visual inspection: badge screenshot looks correct (manual)

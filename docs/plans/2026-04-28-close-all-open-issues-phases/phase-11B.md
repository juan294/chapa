---
phase: 11B
release: v2.11.0
issues: ["#748", "#746", "#772"]
batch_eligible: false
depends_on: ["11A"]
effort: M
---

# Phase 11B — Shared build + tsconfig base + ES2022 (`#748`, `#746`, `#772`)

## Goal

Three TS-config / build issues that touch the same files:

- **`#748`** — `packages/shared/package.json` ships raw `.ts` files
  (`main: "src/index.ts"`). Add a build step so consumers get
  proper `dist/` output.
- **`#746`** — Four `tsconfig.json` files exist (`/`, `apps/web/`,
  `packages/shared/`, `tsconfig.madge.json`) with no shared base.
  `apps/web/tsconfig.json` targets ES2017.
- **`#772`** (wave-3 deferred follow-up to `#746`) — The ES2022 target
  bump itself.

All three resolve cleanly together.

## Pseudocode

### `tsconfig.base.json` (new at root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false
  }
}
```

### `apps/web/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] },
    "incremental": true
  },
  "include": [...],
  "exclude": [...]
}
```

### `packages/shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

### `packages/shared/package.json`

```json
{
  "name": "@chapa/shared",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  }
}
```

### Root build orchestration

```json
// Root package.json scripts add:
{
  "scripts": {
    "build:shared": "pnpm --filter @chapa/shared run build",
    "build": "pnpm run build:shared && pnpm --filter @chapa/web run build",
    "dev": "pnpm run build:shared && pnpm --filter @chapa/web run dev"
  }
}
```

`apps/web/package.json` adds `@chapa/shared` to its `dependencies` (already
there as `workspace:*`) — no change needed; pnpm reads the new `main`/`types`.

## Files

- New: `tsconfig.base.json` (root)
- Modified: `tsconfig.json` (root) — extends base
- Modified: `apps/web/tsconfig.json` — extends base, target removed
- Modified: `packages/shared/tsconfig.json` — extends base, adds `outDir`
- Modified: `packages/shared/package.json` — `main`, `types`, `files`,
  `scripts.build`
- Modified: `package.json` (root) — `build` script orchestrates
- Modified: `tsconfig.madge.json` — extends base
- Modified: `.gitignore` — add `packages/shared/dist`,
  `packages/shared/tsconfig.tsbuildinfo`

## Acceptance criteria

### Automated
- [ ] `pnpm run typecheck` passes from a clean checkout
- [ ] `pnpm install && pnpm run build` produces `packages/shared/dist/index.js`
      with `.d.ts` and source maps
- [ ] `pnpm run test` passes — apps/web's import resolution works through
      `dist/`
- [ ] `pnpm run lint` passes
- [ ] All routes still build via `next build`

### Manual
- Verify `packages/shared/dist/` is gitignored (no stray commits)
- Vercel preview build succeeds end-to-end

## Closing the issues

```bash
gh issue close 748 --comment "Fixed in <sha>. @chapa/shared now ships dist/ with proper main/types pointing at compiled output."
gh issue close 746 --comment "Fixed in <sha>. tsconfig.base.json at root; all four tsconfigs extend it; apps/web target bumped to ES2022."
gh issue close 772 --comment "Fixed in <sha> (resolved as part of #746). ES2022 target adopted across the workspace."
```

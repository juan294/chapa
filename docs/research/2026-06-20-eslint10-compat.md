# ESLint 10 Compatibility — Upgrade Still Blocked

> Date: 2026-06-20 · Issue: #531 · Outcome: **BLOCKED** (reverted, no upgrade shipped)

## TL;DR

ESLint 10 cannot be adopted yet. The blocker is **`eslint-plugin-react`**, pulled in
transitively by `eslint-config-next@16.2.9`. Its latest published version (`7.37.5`)
still calls the ESLint 9 rule-context API `context.getFilename()`, which **ESLint 10
removed**. Linting crashes immediately under ESLint 10 with a `TypeError`. There is no
published `eslint-plugin-react` release that supports ESLint 10, and `eslint-config-next`
hard-depends on `^7.37.0`. This is the same root cause that deferred #531 originally; it
is an upstream issue outside our control.

## What was attempted

In an isolated worktree (`chore/531-eslint10`, branched from `develop`):

1. Bumped `apps/web` devDependency `eslint` from `^9.39.4` → `^10.5.0`.
2. Added root `pnpm.overrides` entries to force a single ESLint 10 across the tree and to
   pull `eslint-plugin-react-hooks >=7.1.0` (the version that declares `^10.0.0` peer support):
   ```jsonc
   "eslint": "^10.5.0",
   "eslint-plugin-react-hooks": ">=7.1.0"
   ```
3. `pnpm install` — succeeded, **no peer-dependency hard failures or warnings surfaced**
   (pnpm does not block on the lagging `^9`-only peer ranges by default).
4. `npx eslint --version` → `v10.5.0` (resolved correctly).
5. `pnpm run lint` → **crashed**.

## The blocking error

```
ESLint: 10.5.0
TypeError: Error while loading rule 'react/display-name':
  contextOrFilename.getFilename is not a function
    at resolveBasedir (eslint-plugin-react@7.37.5/lib/util/version.js:31:100)
    at detectReactVersion (.../version.js:85:19)
    at getReactVersionFromContext (.../version.js:116:25)
    ...
```

ESLint 10 removed the deprecated `context.getFilename()` method (replaced by the
`context.filename` property). `eslint-plugin-react`'s React-version detection still calls
the removed method, so **every** rule from that plugin throws on load.

## Peer-dependency evidence (as of 2026-06-20)

| Package | Version pulled | `eslint` peer range | ESLint 10 OK? |
|---|---|---|---|
| `eslint` (latest) | `10.5.0` | — | — |
| `eslint-config-next` | `16.2.9` (latest) | `>=9.0.0` | ✓ (range permits, but its deps don't) |
| `typescript-eslint` (override) | `>=8.58.0` | `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` | ✓ |
| `eslint-plugin-react-hooks` | `7.1.0+` | `... \|\| ^9.0.0 \|\| ^10.0.0` | ✓ |
| `eslint-plugin-import` | `2.32.0` | `... \|\| ^8 \|\| ^9` | ✗ peer (but did not crash) |
| `eslint-plugin-jsx-a11y` | `6.10.2` | `... \|\| ^8 \|\| ^9` | ✗ peer (but did not crash) |
| **`eslint-plugin-react`** | **`7.37.5` (latest)** | **`... \|\| ^8 \|\| ^9.7`** | **✗ — RUNTIME CRASH** |

`eslint-config-next@16.2.9` declares `eslint-plugin-react: ^7.37.0` as a direct
dependency. The latest `eslint-plugin-react` on npm is `7.37.5` — there is no `7.38+` or
`8.x` that drops the `getFilename` call.

`eslint-plugin-import` and `eslint-plugin-jsx-a11y` also lag (no `^10` peer declared), so
even if `eslint-plugin-react` were fixed, those two would need verification too — but they
did not crash at runtime in this attempt; `eslint-plugin-react` fails first.

## What's needed to unblock

Any one of the following upstream changes, then re-attempt:

1. **Preferred:** `eslint-plugin-react` ships a release that replaces `context.getFilename()`
   with `context.filename` and declares `eslint: ^10` peer support. Track:
   https://github.com/jsx-eslint/eslint-plugin-react (the `getFilename`/ESLint 10 issue).
2. **And:** `eslint-config-next` bumps its `eslint-plugin-react` (and ideally
   `eslint-plugin-import` / `eslint-plugin-jsx-a11y`) dependency to those ESLint 10–ready
   releases. Watch for a Next.js minor that declares ESLint 10 support.
3. Verify `eslint-plugin-import` and `eslint-plugin-jsx-a11y` either publish `^10` peer
   ranges or are confirmed runtime-safe under ESLint 10.

A `pnpm.overrides` hack cannot fix this — there is simply no compatible
`eslint-plugin-react` artifact to override to. Forcing the override only changes which
crashing version loads.

## Decision

Keep ESLint pinned at `^9.39.4`. Re-evaluate when `eslint-config-next` or
`eslint-plugin-react` ship ESLint 10 support. Baseline lint is green on ESLint 9.39.4;
no changes were merged.

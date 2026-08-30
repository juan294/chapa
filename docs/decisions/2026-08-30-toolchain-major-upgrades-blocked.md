# TypeScript 7 and ESLint 10 are blocked by the plugin ecosystem

Date: 2026-08-30
Status: Accepted (measured; revisit when the unblock conditions below are met)
Issue: #1153 (AR-S1)

## Context

TypeScript 7.0.2 and ESLint 10.9.1 are published. The project runs TypeScript
6.0.3 and ESLint 9.39.4.

#1153's concern is not "upgrade the tools". It is that **a major upgrade can
leave a quality gate green while it silently analyzes fewer files, edges or
rules** — so command success is not evidence, and the gates must be measured
before and after.

## The measurement

Captured on `develop` at `0e6b3007`, before touching any version:

| Gate | Baseline |
|---|---|
| `madge` dependency graph | 979 files, 2502 edges |
| `eslint` over `apps/web` | 962 files linted, 0 messages |
| ESLint resolved config | 115 rules configured, 88 enabled |

**Negative canaries, validated against the current toolchain.** Two temporary
files were introduced and both custom gates fired, confirming the method
detects a weakened gate rather than assuming one:

- `export const leak = process.env.SOME_SECRET;`
  → `no-restricted-syntax`: "Access env vars through @/lib/env getters"
- a relative `../../../packages/shared/src/types` import
  → `no-restricted-imports`: "import is restricted from being used by a pattern"

Both files were deleted after the check. They are deliberately NOT committed as
permanent fixtures: a canary is only meaningful when it is run against a
candidate upgrade, and a checked-in broken file is a standing invitation for
someone to "fix" it.

## Decision

**Neither major can be adopted today.** Both are blocked by third-party peer
ranges, not by this codebase.

### TypeScript 7 — blocked by `typescript-eslint`

The newest `typescript-eslint` is 8.68.0, and its TypeScript peer range is
`>=4.8.4 <6.1.0`. No published release supports TypeScript 7. Every earlier
major is older still.

Adopting TypeScript 7 would therefore run typed linting against an unsupported
compiler, or break it outright — which is precisely the failure #1153 exists to
prevent, arrived at from the other direction.

### ESLint 10 — blocked by three plugins reached through `eslint-config-next`

`eslint-config-next@16.3.3` declares `eslint: ">=9.0.0"`, but the plugins it
pulls in have not followed:

| Plugin | Latest | ESLint peer |
|---|---|---|
| `eslint-plugin-react` | 7.37.5 | `… \|\| ^9.7` |
| `eslint-plugin-jsx-a11y` | 6.10.2 | `… \|\| ^9` |
| `eslint-plugin-import` | 2.32.0 | `… \|\| ^9` |

This was tried, not inferred. With ESLint 10.9.1 installed, `eslint .` exits 2
before linting anything:

```
TypeError: Error while loading rule 'react/display-name':
contextOrFilename.getFilename is not a function
```

That is a loud failure, which is the good case — the dangerous case would have
been a green run over fewer rules. The version bumps were reverted.

## What did change: the circular-dependency gate is now reproducible

`check:circular` ran as `pnpm dlx madge …`, which resolves the latest `madge`
at run time. A gate whose analyzer version can change between two runs of the
same commit cannot be compared before and after anything — the exact property
#1153 asks for. `madge` is now a pinned devDependency (`8.0.0`) invoked through
the lockfile. It processes the same 979 files as before the pin.

This also answers the issue's "Madge still relies on older resolver behavior"
note: the resolver is whatever the pin says, and changing it is now a visible
commit rather than a silent drift.

## Unblock conditions

Re-attempt when **all** of these hold, and re-run the measurement above:

- `typescript-eslint` publishes a release whose TypeScript peer admits `7.x`
  (for the TypeScript 7 half).
- `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import`
  publish releases admitting `eslint@^10` — or `eslint-config-next` stops
  depending on the ones that do not (for the ESLint 10 half).

The two halves are independent and should ship as separate commits, so a
regression in gate strength is attributable to one tool.

## Consequences

- The upgrade is deferred with evidence rather than left as an open question.
- The baseline numbers above are the comparison point for the next attempt.
- No new CI job was added. The measurement is a procedure to run against a
  candidate upgrade, not standing infrastructure.

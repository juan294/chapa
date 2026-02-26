# Phase 1: Feature Flag + Platform Type

> Parent: [Codeberg Integration Plan](../2026-02-26-codeberg-integration.md)
> Depends on: Nothing
> Estimated new files: 0
> Estimated modified files: 3

## Goal

Extend the Platform type to include `"codeberg"` and add feature flag functions so that all subsequent phases can gate on `isCodebergEnabled()`.

## Changes

### 1. Extend Platform type

**File:** `packages/shared/src/platforms.ts:2`

```diff
- export type Platform = "github" | "bitbucket";
+ export type Platform = "github" | "bitbucket" | "codeberg";
```

No other changes to this file. The `LinkedPlatform` interface is generic over `Platform` and works as-is.

### 2. Add feature flag functions

**File:** `apps/web/lib/feature-flags.ts`

Add sync and async Codeberg flag functions, mirroring the Bitbucket pattern:

```typescript
// After isBitbucketEnabledSync() at line 25:
export function isCodebergEnabledSync(): boolean {
  return process.env.NEXT_PUBLIC_CODEBERG_ENABLED?.trim() === "true";
}

// After isBitbucketEnabled() at line 60:
export async function isCodebergEnabled(): Promise<boolean> {
  return checkFlag(
    "codeberg_integration",
    process.env.NEXT_PUBLIC_CODEBERG_ENABLED,
  );
}
```

### 3. Add feature flag tests

**File:** `apps/web/lib/feature-flags.test.ts`

Add test cases mirroring the Bitbucket flag tests:

```typescript
describe("isCodebergEnabledSync", () => {
  it("returns true when NEXT_PUBLIC_CODEBERG_ENABLED is 'true'", () => {
    process.env.NEXT_PUBLIC_CODEBERG_ENABLED = "true";
    expect(isCodebergEnabledSync()).toBe(true);
  });

  it("returns false when NEXT_PUBLIC_CODEBERG_ENABLED is unset", () => {
    delete process.env.NEXT_PUBLIC_CODEBERG_ENABLED;
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it("returns false when NEXT_PUBLIC_CODEBERG_ENABLED is 'false'", () => {
    process.env.NEXT_PUBLIC_CODEBERG_ENABLED = "false";
    expect(isCodebergEnabledSync()).toBe(false);
  });

  it("trims whitespace from env var", () => {
    process.env.NEXT_PUBLIC_CODEBERG_ENABLED = "  true  ";
    expect(isCodebergEnabledSync()).toBe(true);
  });
});

describe("isCodebergEnabled", () => {
  it("returns true when DB flag is enabled", async () => {
    // Mock dbGetFeatureFlag to return { enabled: true }
    expect(await isCodebergEnabled()).toBe(true);
  });

  it("falls back to env var when DB flag is null", async () => {
    // Mock dbGetFeatureFlag to return null
    process.env.NEXT_PUBLIC_CODEBERG_ENABLED = "true";
    expect(await isCodebergEnabled()).toBe(true);
  });
});
```

## Success Criteria

### Automated
- [x] `pnpm run typecheck` passes (Platform union updated, new functions exported)
- [x] `pnpm run test -- feature-flags` passes (new test cases green)
- [x] `pnpm run lint` passes

### Manual
- None — this phase is purely type + flag infrastructure.

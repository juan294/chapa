# ADR: `createModuleStore` — a shared module-level store primitive

- **Date:** 2026-06-20
- **Status:** Accepted
- **Issue:** #774 (FE-S1)

## Context

Several client modules hand-rolled the same "module-level shared state"
pattern, each diverging slightly:

1. `apps/web/hooks/useSession.ts` — a promise cache plus a synchronous result
   cache, read inside `useState` initializers and reset on logout.
2. `apps/web/components/KeyboardShortcutsListener.tsx` — a classic
   `useSyncExternalStore` store: a single value, a `Set` of subscribers, a
   `getSnapshot`, a `getServerSnapshot`, and a publish-on-change setter.
3. `apps/web/components/UserMenu.tsx` — a plain object cache for platform-link
   status, persisted across mounts, read imperatively and reset on
   link/unlink/logout.

The duplication made each store its own small, subtly different
implementation. We wanted one reviewed primitive that captures the canonical
shape.

## Decision

Add `apps/web/hooks/createModuleStore.ts`:

```ts
const store = createModuleStore<T>(initialValue, { serverSnapshot });
store.getSnapshot();        // synchronous read (outside React)
store.getServerSnapshot();  // SSR / first hydration render
store.set(next);            // replace value + notify subscribers
store.subscribe(cb);        // returns an unsubscribe function
store.useStore();           // React hook (useSyncExternalStore)
```

It holds a single value of type `T`. Richer state is modelled as an object and
replaced wholesale via `set()`. `getServerSnapshot` defaults to the initial
value but can be overridden (e.g. `null` for stores that must be empty during
SSR).

## Migration

- **KeyboardShortcutsListener** — migrated fully. This was the canonical
  `useSyncExternalStore` fit: the manual `_store`/`_subscribers`/snapshot/
  subscribe/set functions were replaced by a single
  `createModuleStore<KeyboardShortcutsStore | null>(null, { serverSnapshot: null })`,
  and the public hook now calls `store.useStore()`. The thin `setStore()`
  wrapper is kept so the layout-effect publish/cleanup call sites are
  unchanged.

- **UserMenu platform status cache** — migrated to back the cache with
  `createModuleStore<PlatformStatusCache>`. This cache has **no reactive
  subscribers**: components read it imperatively in `useState` initializers and
  effects, and write it after fetches/unlinks. The migration preserves the
  exact previous semantics — `getSnapshot()` returns the single shared object
  instance, so the existing in-place field mutations
  (`...getSnapshot()[platform] = status`, `...getSnapshot().fetched = true`)
  persist across mounts just as before; `clearPlatformStatusCache()` swaps in a
  fresh object via `set()`.

- **useSession** — **intentionally not migrated.** Its caching is a *promise*
  cache (for in-flight request de-duplication) layered with a synchronous
  result cache read inside `useState` initializers, and its loading flag is
  derived from `cachedResult === undefined`. None of that maps onto a
  single-value subscriber store: the promise cache is orthogonal to the store's
  value, and the login/logout reset semantics are load-bearing (a prior
  session-cache logout bug, #732, must not be reintroduced). Forcing the
  primitive in would add indirection without behavioural benefit and risk the
  exact behaviour we must preserve. `useSession` keeps its bespoke
  implementation; `clearSessionCache()` is unchanged.

## Consequences

- One reviewed, unit-tested primitive for the subscriber/snapshot pattern.
- New module-level reactive state should use `createModuleStore` rather than a
  fresh hand-rolled store.
- `useSession` remains an accepted, documented exception because its
  promise-cache + sync-result-cache shape is a poor fit for the primitive.

---
description: Choosing await, after(), or fireAndForget for server-side work
paths:
  - "apps/web/**/*.ts"
  - "apps/web/**/*.tsx"
---

# Post-response work

Choose the scheduling primitive from the promise made by the response:

- Use plain `await` when the response promises the outcome. Durable writes or
  cache invalidations reported as completed by a user-visible
  save/refresh/link/unlink belong here. If failure is recoverable, await it and
  return an honest result such as `persisted: false` or
  `badgeRefreshed: false`.
- Use Next.js `after()` when work may start after the response but still must
  finish. Register it before returning and return/await the complete promise
  from its callback. Deferred durable work must capture or log failures; do not
  let the callback reject silently.
- Use `fireAndForget` only for work that is genuinely safe to lose, such as
  telemetry, opportunistic cache fills, or non-critical client refreshes. It
  handles promise rejection but does not extend a Vercel function's lifetime,
  so it is not a substitute for `after()`.

Inside an `after()` callback, await required child work rather than detaching it
with `fireAndForget`. Tests for route scheduling should capture `after()`
callbacks and assert whether work happens before the response or only when the
callback runs.

The production incident behind this rule is documented in
`docs/decisions/2026-09-01-badge-edge-cache-purge.md` (#1268).

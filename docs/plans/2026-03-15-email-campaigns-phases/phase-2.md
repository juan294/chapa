# Phase 2: Contact Sync Pipeline [batch-eligible with Phase 3]

## Goal

Keep Resend contacts in sync with Supabase users — real-time on login, daily via cron, bidirectional unsubscribe.

---

## 1. OAuth Callback — Sync on Login

**File**: `apps/web/app/api/auth/callback/route.ts` (modify)

After the existing `dbUpsertUser()` call (line 119-123), add a fire-and-forget audience sync:

```pseudo
// Existing code (line 119-123):
void dbUpsertUser(user.login, {
  email: email ?? undefined,
  displayName: user.name ?? null,
  avatarUrl: user.avatar_url ?? null,
}).catch(() => {});

// NEW: Sync to Resend audience (fire-and-forget)
if (email) {
  void addContact(email, {
    firstName: user.name ?? undefined,
    handle: user.login,
  }).catch(() => {});
}
```

**Import**: `import { addContact } from "@/lib/email/audience"`

**Design**:
- Fire-and-forget (void promise) — never blocks OAuth response
- Only syncs if email was captured (not null)
- `addContact` handles 409 conflict (existing contact) internally
- Uses `user.name` as firstName, falls back to `user.login` as handle

---

## 2. Daily Audience Sync Cron

**File**: `apps/web/app/api/cron/sync-audience/route.ts` (new)

### Route: `GET /api/cron/sync-audience`

Auth: Bearer token via `CRON_SECRET` (same pattern as warm-cache).

```pseudo
export async function GET(request: NextRequest)
  // 1. Auth — same pattern as warm-cache/route.ts:73-84
  secret = process.env.CRON_SECRET?.trim()
  if !secret → 401
  authHeader = request.headers.get("Authorization")
  token = authHeader starts with "Bearer " ? slice(7) : ""
  if !token || !safeEqual(token, secret) → 401

  // 2. Get segment ID (creates if needed)
  segmentId = await ensureSegment()
  if !segmentId → return { status: "skipped", reason: "no_segment" }

  // 3. Get all eligible users from Supabase
  users = await dbGetUsersWithEmail()

  // 4. Get existing Resend contacts (paginate through all)
  existingContacts = await listAllContacts(segmentId)
  existingByEmail = Map(existingContacts.map(c → [c.email, c]))

  // 5. Determine sync operations
  toAdd: users not in existingByEmail
  toUpdate: users in existingByEmail where unsubscribed=true but our DB says notifications=true
  toMarkUnsubscribed: existingContacts where unsubscribed=false but user not in eligible list
    (either email_notifications=false or user no longer has email)

  // 6. Process in batches (reuse processInBatches pattern)
  addResults = await processInBatches(toAdd, 5, user →
    addContact(user.email, { firstName: user.displayName, handle: user.handle })
  )
  updateResults = await processInBatches(toUpdate, 5, user →
    updateContact(user.email, { unsubscribed: false })
  )
  unsubResults = await processInBatches(toMarkUnsubscribed, 5, contact →
    markUnsubscribed(contact.email)
  )

  // 7. Return summary
  return { synced: addResults, updated: updateResults, unsubscribed: unsubResults }
```

### Helper: `listAllContacts(segmentId)`

Paginate through Resend contacts API to get all contacts in the segment:

```pseudo
async function listAllContacts(segmentId: string): Promise<Contact[]>
  resend = getResend()
  if !resend → return []

  all: Contact[] = []
  cursor: string | undefined

  loop:
    { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      after: cursor,
    })
    if error → break
    all.push(...data.data)
    if !data.has_more → break
    cursor = data.data[data.data.length - 1].id

  return all
```

### Helper: `processInBatches<T>`

Reuse the same pattern from warm-cache (lines 38-50):

```pseudo
async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]>
  results = []
  for i = 0; i < items.length; i += batchSize
    batch = items.slice(i, i + batchSize)
    batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
  return results
```

---

## 3. Unsubscribe — Sync to Resend

**File**: `apps/web/app/api/notifications/unsubscribe/route.ts` (modify)

After the existing `dbUpdateEmailNotifications()` call (line 39-45), add Resend sync:

```pseudo
// Existing code (line 39-45):
try {
  await dbUpdateEmailNotifications(handle, false);
} catch { ... }

// NEW: Sync unsubscribe to Resend (fire-and-forget)
void (async () => {
  const email = await dbGetUserEmail(handle);
  // dbGetUserEmail returns the email even after setting notifications=false
  // (it fetches from DB where we just updated)
  // We need to query the email BEFORE updating, or query just the email field
  // Actually: we can query the email separately since handle is known
  if (email?.email) {
    await markUnsubscribed(email.email);
  }
})().catch(() => {});
```

**Note**: Need to fetch the user's email address first (the unsubscribe endpoint only receives `handle`, not `email`). The existing `dbGetUserEmail(handle)` call works — it returns the email even when `email_notifications` is now false (we just need the email address to update Resend).

Actually, since `dbUpdateEmailNotifications` modifies `email_notifications` but not `email`, we can fetch the email in parallel:

```pseudo
// Better approach: fetch email and update DB in parallel
const [emailInfo] = await Promise.all([
  dbGetUserEmail(handle).catch(() => null),  // gets email before notifications flag matters
  dbUpdateEmailNotifications(handle, false).catch(() => {}),
]);

// Sync to Resend
if (emailInfo?.email) {
  void markUnsubscribed(emailInfo.email).catch(() => {});
}
```

**Imports to add**: `import { markUnsubscribed } from "@/lib/email/audience"`; `import { dbGetUserEmail } from "@/lib/db/users"`

---

## 4. Vercel Cron Schedule

**File**: `vercel.json` (modify)

Add the sync-audience cron to the existing crons array:

```pseudo
{
  "crons": [
    // ... existing crons ...
    {
      "path": "/api/cron/sync-audience",
      "schedule": "30 3 * * *"   // Daily at 3:30 AM UTC (after warm-cache at ~2-3 AM)
    }
  ]
}
```

---

## 5. Tests

### `apps/web/app/api/cron/sync-audience/route.test.ts` (new)

Mock: `getResend()`, `ensureSegment()`, `dbGetUsersWithEmail()`, `addContact()`, `updateContact()`, `markUnsubscribed()`, contacts list API.

**Test cases**:

1. Returns 401 without valid CRON_SECRET
2. Returns 401 with wrong Bearer token
3. Returns skipped when segment creation fails
4. Adds new contacts for users not in Resend
5. Skips users already in Resend (no duplicate adds)
6. Re-enables contacts that were unsubscribed in Resend but active in DB
7. Marks contacts as unsubscribed when user has email_notifications=false
8. Handles empty user list gracefully
9. Handles Resend API errors without crashing (per-item isolation)
10. Returns correct summary counts

### `apps/web/app/api/notifications/unsubscribe/route.test.ts` (modify)

Add test cases:

11. Syncs unsubscribe to Resend when user has email
12. Does not crash when Resend sync fails (fire-and-forget)
13. Does not call Resend sync when user has no email

### OAuth callback test (if exists, modify):

14. Calls `addContact` when email is captured during OAuth
15. Does not call `addContact` when email is null

---

## Success Criteria

### Automated
- All new + modified tests pass
- `pnpm run typecheck` clean
- `pnpm run lint` clean

### Manual
- Log in via GitHub OAuth → check Resend dashboard → new contact exists in "Chapa Users" segment
- Click unsubscribe link → check Resend dashboard → contact shows `unsubscribed: true`

# Phase 1: Audience & Contact Management Foundation

## Goal

Create the Resend segment/contact management layer and a bulk user email query function.

---

## 1. Bulk User Email Query — `dbGetUsersWithEmail()`

**File**: `apps/web/lib/db/users.ts` (modify)

Add a new function that queries all users who have an email and have notifications enabled:

```pseudo
export interface UserWithEmail {
  handle: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

export async function dbGetUsersWithEmail(): Promise<UserWithEmail[]>
  supabase = getSupabase()
  if !supabase → return []

  query = supabase
    .from("users")
    .select("handle, email, display_name, avatar_url")
    .not("email", "is", null)
    .eq("email_notifications", true)
    .order("registered_at", ascending: false)

  { data, error } = await query
  if error → console.error, return []

  return data.map(row → {
    handle: row.handle,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  })
```

**Pattern**: Same fail-open pattern as `dbGetUsers()` (line 77-109).

---

## 2. Audience Management Layer — `audience.ts`

**File**: `apps/web/lib/email/audience.ts` (new)

### Constants

```pseudo
SEGMENT_NAME = "Chapa Users"
```

### `ensureSegment(): Promise<string | null>`

Auto-creates or finds the "Chapa Users" segment. Returns the segment ID or null on failure.

```pseudo
export async function ensureSegment(): Promise<string | null>
  resend = getResend()
  if !resend → return null

  // Try to find existing segment by name
  { data: listData, error: listError } = await resend.segments.list()
  if listError → console.error, return null

  existing = listData.data.find(s → s.name === SEGMENT_NAME)
  if existing → return existing.id

  // Create new segment
  { data: createData, error: createError } = await resend.segments.create({ name: SEGMENT_NAME })
  if createError → console.error, return null

  return createData.id
```

### `addContact(email, opts): Promise<string | null>`

Adds a single contact to the segment. Returns contact ID or null.

```pseudo
export async function addContact(
  email: string,
  opts?: { firstName?: string; handle?: string }
): Promise<string | null>
  resend = getResend()
  if !resend → return null

  segmentId = await ensureSegment()
  if !segmentId → return null

  { data, error } = await resend.contacts.create({
    email,
    firstName: opts?.firstName ?? opts?.handle ?? undefined,
    unsubscribed: false,
    segments: [{ id: segmentId }],
  })

  if error →
    // If contact already exists (409), try to update instead
    if error.statusCode === 409 →
      return updateContact(email, { unsubscribed: false })
    console.error, return null

  return data.id
```

### `updateContact(email, opts): Promise<string | null>`

Updates an existing contact's properties.

```pseudo
export async function updateContact(
  email: string,
  opts: { firstName?: string | null; unsubscribed?: boolean }
): Promise<string | null>
  resend = getResend()
  if !resend → return null

  { data, error } = await resend.contacts.update({
    email,
    ...opts,
  })

  if error → console.error, return null
  return data.id
```

### `removeContact(email): Promise<boolean>`

Removes a contact from Resend entirely.

```pseudo
export async function removeContact(email: string): Promise<boolean>
  resend = getResend()
  if !resend → return false

  { error } = await resend.contacts.remove({ email })
  if error → console.error, return false
  return true
```

### `markUnsubscribed(email): Promise<string | null>`

Sets a contact's unsubscribed flag to true.

```pseudo
export async function markUnsubscribed(email: string): Promise<string | null>
  return updateContact(email, { unsubscribed: true })
```

### `getSegmentId(): Promise<string | null>`

Convenience alias for `ensureSegment()`.

```pseudo
export const getSegmentId = ensureSegment
```

### `_resetSegmentCache(): void`

Test helper — resets any cached segment ID.

---

## 3. Tests

### `apps/web/lib/email/audience.test.ts` (new)

Mock `getResend()` to return a mock Resend client with `segments` and `contacts` stubs.

**Test cases**:

1. `ensureSegment` — returns existing segment ID when found by name
2. `ensureSegment` — creates new segment when none exists
3. `ensureSegment` — returns null when Resend unavailable
4. `ensureSegment` — returns null when list fails
5. `addContact` — creates contact with segment association
6. `addContact` — handles 409 conflict by updating instead
7. `addContact` — returns null when Resend unavailable
8. `addContact` — passes firstName from opts or handle
9. `updateContact` — updates contact by email
10. `updateContact` — returns null on error
11. `removeContact` — removes contact and returns true
12. `removeContact` — returns false on error
13. `markUnsubscribed` — sets unsubscribed to true via updateContact

### `apps/web/lib/db/users.test.ts` (modify or create)

**Test cases for `dbGetUsersWithEmail()`**:

1. Returns users with email and notifications enabled
2. Excludes users with null email
3. Excludes users with email_notifications = false
4. Returns empty array when DB unavailable
5. Maps snake_case to camelCase correctly

---

## Success Criteria

### Automated
- All new tests pass
- `pnpm run typecheck` clean
- `pnpm run lint` clean

### Manual
- None (pure library code)

# Research: Bulk Email Campaign to Registered Users

> **Date**: 2026-03-15
> **Goal**: Understand what exists and what's needed to send a well-crafted announcement email to all registered Chapa users with unsubscribe support.

---

## 1. Current Email Infrastructure

### Resend Integration

| Component | File | Purpose |
|-----------|------|---------|
| SDK Client | `apps/web/lib/email/resend.ts:43-56` | Lazy singleton `getResend()` — returns `Resend` or `null` if `RESEND_API_KEY` missing |
| First-badge notification | `apps/web/lib/email/notifications.ts` | One-time email to **admin** (`SUPPORT_FORWARD_EMAIL`) when a user first generates a badge |
| Score-bump notification | `apps/web/lib/email/score-bump.ts` | Email to **individual users** on significant score changes (behind `score_notifications` feature flag) |
| Inbound forwarding | `apps/web/app/api/webhooks/resend/route.ts` | Receives inbound emails via Resend/Svix webhook, forwards to Gmail |
| Unsubscribe | `apps/web/app/api/notifications/unsubscribe/route.ts` | `GET /api/notifications/unsubscribe?handle=:handle` — sets `email_notifications=false` |

**Package versions** (`apps/web/package.json`):
- `resend` v6.9.3
- `svix` v1.86.0 (webhook signature verification)

**No React Email (`@react-email`) installed.** All email templates are inline HTML strings with plain-text fallbacks.

### Sender Addresses (domain: `chapa.thecreativetoken.com`, verified in Resend)

| Address | Used by |
|---------|---------|
| `notifications@chapa.thecreativetoken.com` | `notifyFirstBadge()`, `notifyScoreBump()` |
| `support@chapa.thecreativetoken.com` | `forwardEmail()` |

### Environment Variables

```
RESEND_API_KEY             # Resend SDK (required for any email sending)
RESEND_WEBHOOK_SECRET      # Svix webhook verification (inbound only)
SUPPORT_FORWARD_EMAIL      # Gmail for forwarded emails
NEXT_PUBLIC_BASE_URL       # Base URL for links in emails
```

---

## 2. User Email Storage

### Database Schema

**Table: `users`** (Supabase)

| Column | Type | Default | Migration |
|--------|------|---------|-----------|
| `id` | BIGINT PK | auto | 001 |
| `handle` | TEXT UNIQUE NOT NULL | — | 001 |
| `registered_at` | TIMESTAMPTZ | `now()` | 001 |
| `email` | TEXT (nullable) | — | 004 |
| `email_notifications` | BOOLEAN | `true` | 004 |
| `display_name` | TEXT (nullable) | — | 011 |
| `avatar_url` | TEXT (nullable) | — | 011 |

- Schema: `supabase/migrations/001_create_tables.sql:8-14`, `004_add_user_email.sql`, `011_add_user_profile_fields.sql`
- RLS enabled; service role key bypasses (no anon access)

### How Emails Are Captured

1. User authorizes GitHub OAuth with scopes `read:user user:email` (`apps/web/lib/auth/github.ts:32`)
2. Callback fetches primary verified email from `GET https://api.github.com/user/emails` (`github.ts:210-229`)
3. `dbUpsertUser(handle, { email })` stores it in Supabase (`apps/web/app/api/auth/callback/route.ts:117-123`)
4. If GitHub email fetch fails, `email` is set to `undefined` (not stored)

**Implication**: Not all registered users have an email on file. Some may have `email = NULL` if the GitHub API call failed during their login.

### Data Access Functions (`apps/web/lib/db/users.ts`)

| Function | Line | Returns | Notes |
|----------|------|---------|-------|
| `dbUpsertUser(handle, opts?)` | 41-70 | `void` | Stores email during OAuth |
| `dbGetUsers(opts?)` | 77-109 | `{handle, registeredAt, displayName, avatarUrl}[]` | **Does NOT return `email`** |
| `dbGetUserEmail(handle)` | 124-148 | `{email, emailNotifications}` or `null` | Per-user lookup only |
| `dbUpdateEmailNotifications(handle, enabled)` | 154-174 | `void` | Sets `email_notifications` flag |

**Gap**: There is no function to bulk-query all users with their emails. `dbGetUsers()` omits email, and `dbGetUserEmail()` works one handle at a time.

---

## 3. Unsubscribe Mechanism

### Existing Endpoint

**`GET /api/notifications/unsubscribe?handle=:handle`** (`apps/web/app/api/notifications/unsubscribe/route.ts`)

- Rate-limited: 10 req/IP/60s
- Lowercases handle, calls `dbUpdateEmailNotifications(handle, false)`
- Returns a self-contained HTML confirmation page (dark theme, brand colors)
- Fail-open: shows confirmation even if DB update fails
- XSS-safe: escapes handle via `escapeHtml()`

### How It's Used Today

- Score-bump emails include unsubscribe link in footer: `{baseUrl}/api/notifications/unsubscribe?handle={handle}` (`score-bump.ts:58`)
- First-badge emails do NOT include unsubscribe (they go to admin, not users)

### Unsubscribe Link Format

```
https://chapa.thecreativetoken.com/api/notifications/unsubscribe?handle={handle}
```

---

## 4. Existing Email Templates

### Pattern Used

Both notification emails use **inline HTML strings** (not JSX/React Email components):

- Dark theme: `#0A0A0F` background, `#111118` card, `#E2E4E9` text, `#8B5CF6` accent
- Inline CSS throughout (email-client compatible)
- Plain-text fallback provided alongside HTML
- CTA buttons with purple background + white text
- Footer with unsubscribe link (score-bump only)

### Score-Bump Template Structure (`score-bump.ts:191-308`)

```
┌─────────────────────────────┐
│  Purple gradient header     │
│  "Score Update"             │
├─────────────────────────────┤
│  Headline (change-specific) │
│  Score delta (large, green) │
│  Dimension changes (+/-)    │
│  CTA: "View Your Badge"    │
├─────────────────────────────┤
│  Footer: Unsubscribe link   │
└─────────────────────────────┘
```

### First-Badge Template Structure (`notifications.ts:141-229`)

```
┌─────────────────────────────┐
│  Purple gradient header     │
│  "New Badge Created"        │
├─────────────────────────────┤
│  Handle, archetype, tier    │
│  Scores + dimensions        │
│  CTA: "View Profile"       │
│  CTA: "View Badge SVG"     │
├─────────────────────────────┤
│  Footer: timestamp          │
└─────────────────────────────┘
```

---

## 5. Resend SDK Capabilities (v6.9.3)

### Relevant APIs for Bulk Email

| API | Method | Purpose | Rate Limit |
|-----|--------|---------|------------|
| **Single send** | `resend.emails.send()` | Send one email | 10/sec (free), 100/sec (pro) |
| **Batch send** | `resend.batch.send()` | Send up to 100 emails in one API call | Same as single but batched |
| **Audiences** | `resend.audiences.*` | Manage contact lists (create, list, delete) | — |
| **Contacts** | `resend.contacts.*` | Add/remove contacts in an audience | — |
| **Broadcasts** | `resend.broadcasts.*` | Send to an entire audience at once | — |

### Two Approaches for Bulk Email

**Approach A: Batch Send (programmatic, no Resend Audience)**
- Query users from Supabase directly
- Use `resend.batch.send()` in chunks of 100
- Full control over template, personalization, timing
- Unsubscribe link uses existing endpoint

**Approach B: Resend Audiences + Broadcasts**
- Sync users to a Resend Audience as Contacts
- Use Broadcast feature to send to entire audience
- Resend manages delivery, open tracking, unsubscribes
- Requires ongoing audience sync (users added/removed)
- Resend provides its own unsubscribe mechanism

---

## 6. What Does NOT Exist Today

| Gap | Description |
|-----|-------------|
| **Bulk email query** | No function to fetch all users with email + notification preference in one query |
| **Batch send utility** | No code uses `resend.batch.send()` or iterates over users to send bulk emails |
| **Announcement template** | No email template designed for product announcements/newsletters |
| **Campaign trigger** | No admin endpoint, script, or cron job for triggering a campaign |
| **Send tracking** | No record of which emails were sent to which users for a given campaign |
| **Resend Audiences** | No code interacts with Resend's Audiences, Contacts, or Broadcasts APIs |
| **Email preview/test** | No way to preview or test-send an email before broadcasting |

---

## 7. Existing Patterns to Reuse

| Pattern | Source | Applicable to Campaign |
|---------|--------|----------------------|
| Inline HTML dark-theme email template | `score-bump.ts:191-308` | Base template structure, colors, CTA buttons |
| Plain-text fallback alongside HTML | `score-bump.ts:131-185` | Required for deliverability |
| Unsubscribe link in footer | `score-bump.ts:58` | Must be in every campaign email |
| `escapeHtml()` for user-controlled text | `resend.ts` / `escape.ts` | Escape handle in unsubscribe link |
| Fire-and-forget with error isolation | `notifications.ts:102-107` | Per-user send errors shouldn't abort campaign |
| Redis dedup markers | `notifications.ts:28-32` | Prevent duplicate sends if campaign is re-run |
| Feature flag gating | `score-bump.ts:37-38` | Gate campaign behind a flag |
| `getResend()` lazy singleton | `resend.ts:43-56` | Reuse existing client |

---

## 8. Constraints and Considerations

### Resend Rate Limits
- **Free plan**: 100 emails/day, 10/second
- **Pro plan**: 50,000 emails/month, 100/second
- Current plan status: unknown from code alone — check Resend dashboard

### User Count
- Total users queryable via `dbGetUsers()` (paginated, up to 1000 per page)
- Not all have email (nullable column)
- Not all have `email_notifications=true`
- Effective send count = users WHERE email IS NOT NULL AND email_notifications = true

### Legal / Best Practices
- CAN-SPAM / GDPR require: sender identification, unsubscribe mechanism, honor opt-outs
- Existing unsubscribe endpoint satisfies opt-out requirement
- First email to users — should set expectations about email frequency
- `email_notifications` defaults to `true` (opt-out model), which is acceptable for transactional/product emails when user created an account

### Deliverability
- Domain `chapa.thecreativetoken.com` is already verified in Resend (sender addresses work)
- Inline CSS is standard practice for email HTML
- Plain-text fallback improves deliverability
- Batch sends from a warm domain with verified SPF/DKIM have good deliverability

---

## 9. Summary

Chapa has a solid email foundation: Resend SDK integrated, domain verified, two sender addresses active, unsubscribe endpoint working, and dark-themed HTML email templates in production. The infrastructure supports **individual transactional emails** (score bumps, first-badge alerts).

What's missing for a **bulk announcement campaign** is:
1. A bulk user+email query function
2. A batch send mechanism (chunked `resend.batch.send()` or sequential sends)
3. An announcement-specific email template
4. A trigger mechanism (admin endpoint or one-off script)
5. Campaign dedup to prevent re-sends
6. Optionally: send tracking / delivery logging

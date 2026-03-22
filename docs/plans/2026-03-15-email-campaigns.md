# Plan: Resend Audiences + Broadcasts for Email Campaigns

> **Date**: 2026-03-15
> **Research**: `docs/research/2026-03-15-bulk-email-campaign.md`
> **Branch pattern**: `feature/email-campaigns-phase-N`

---

## Context

Chapa needs to send a first announcement email to all registered users about new dashboard features. The existing email infrastructure handles transactional emails (score bumps, first-badge alerts) but has no bulk/campaign capability.

**Approach**: Resend Segments + Contacts for audience management, with a campaign engine that sends via `resend.batch.send()` in daily batches (Free plan: 100 emails/day).

**Design constraints**:
- Resend Free plan: 100 emails/day, 10/second, 100 per batch API call
- Resend SDK v6.9.3: `audiences` deprecated → use `segments`
- Sender: `notifications@chapa.thecreativetoken.com` (existing verified address)
- Email aesthetic: developer-first, dark theme, mostly text, JetBrains Mono headings, minimal images
- Unsubscribe: existing endpoint + Resend contact `unsubscribed` flag (bidirectional sync)

---

## Phase Overview

| Phase | Description | Depends on | Batch-eligible |
|-------|-------------|------------|----------------|
| 1 | Audience & Contact Management Foundation | — | — |
| 2 | Contact Sync Pipeline (OAuth + Cron + Unsubscribe) | Phase 1 | with Phase 3 |
| 3 | Campaign Engine & Announcement Template | Phase 1 | with Phase 2 |
| 4 | Admin Campaigns Dashboard | Phases 2, 3 | — |

---

## Phase 1: Audience & Contact Management Foundation ✅

**Goal**: Create the Resend segment/contact management layer and bulk user email query.

**Files created**:
- [x] `apps/web/lib/email/audience.ts` — segment + contact CRUD
- [x] `apps/web/lib/email/audience.test.ts` — tests (21 tests)

**Files modified**:
- [x] `apps/web/lib/db/users.ts` — add `dbGetUsersWithEmail()`
- [x] `apps/web/lib/db/users.test.ts` — add tests (4 new tests)

**Details**: [Phase 1 spec](2026-03-15-email-campaigns-phases/phase-1.md)

---

## Phase 2: Contact Sync Pipeline ✅

**Goal**: Keep Resend contacts in sync with Supabase users — real-time on login, daily via cron, bidirectional unsubscribe.

**Files created**:
- [x] `apps/web/app/api/cron/sync-audience/route.ts` — daily sync cron
- [x] `apps/web/app/api/cron/sync-audience/route.test.ts` — tests (9 tests)

**Files modified**:
- [x] `apps/web/app/api/auth/callback/route.ts` — add audience sync on login
- [x] `apps/web/app/api/notifications/unsubscribe/route.ts` — sync unsubscribe to Resend
- [x] `apps/web/app/api/notifications/unsubscribe/route.test.ts` — update tests (+2 tests)
- [x] `vercel.json` — add sync-audience cron schedule

**Details**: [Phase 2 spec](2026-03-15-email-campaigns-phases/phase-2.md)

---

## Phase 3: Campaign Engine & Announcement Template ✅

**Goal**: Campaign CRUD, batch send with daily quota, developer-aesthetic announcement template.

**Files created**:
- [x] `apps/web/lib/email/campaigns.ts` — campaign logic (create, send batches, status)
- [x] `apps/web/lib/email/campaigns.test.ts` — tests (8 tests)
- [x] `apps/web/lib/email/templates/announcement.ts` — announcement email template builder
- [x] `apps/web/lib/email/templates/announcement.test.ts` — tests (10 tests)
- [x] `apps/web/lib/db/campaigns.ts` — campaign DB access layer
- [x] `apps/web/lib/db/campaigns.test.ts` — tests (11 tests)
- [x] `supabase/migrations/016_create_email_campaigns.sql` — campaigns + sends tables
- [x] `apps/web/app/api/cron/process-campaigns/route.ts` — daily send processor
- [x] `apps/web/app/api/cron/process-campaigns/route.test.ts` — tests (4 tests)

**Details**: [Phase 3 spec](2026-03-15-email-campaigns-phases/phase-3.md)

---

## Phase 4: Admin Campaigns Dashboard ✅

**Goal**: Admin UI to create, preview, and send campaigns.

**Files created**:
- [x] `apps/web/app/admin/campaigns/campaigns-dashboard.tsx` — campaigns tab component (607 lines)
- [x] `apps/web/app/admin/campaigns/campaigns-dashboard.test.tsx` — tests (6 tests)
- [x] `apps/web/app/api/admin/campaigns/route.ts` — GET list, POST create
- [x] `apps/web/app/api/admin/campaigns/route.test.ts` — tests (5 tests)
- [x] `apps/web/app/api/admin/campaigns/[id]/route.ts` — GET detail, PATCH update, DELETE
- [x] `apps/web/app/api/admin/campaigns/[id]/route.test.ts` — tests (6 tests)
- [x] `apps/web/app/api/admin/campaigns/[id]/send/route.ts` — POST trigger send
- [x] `apps/web/app/api/admin/campaigns/[id]/send/route.test.ts` — tests (4 tests)
- [x] `apps/web/app/api/admin/campaigns/[id]/preview/route.ts` — GET preview HTML
- [x] `apps/web/app/api/admin/campaigns/[id]/preview/route.test.ts` — tests (3 tests)

**Files modified**:
- [x] `apps/web/app/admin/useAdminDashboard.ts` — add `"campaigns"` to `AdminTab`
- [x] `apps/web/app/admin/AdminDashboardClient.tsx` — add tab button + content pane + dynamic import
- [x] `vercel.json` — add process-campaigns cron schedule

**Details**: [Phase 4 spec](2026-03-15-email-campaigns-phases/phase-4.md)

---

## Verification (all phases)

### Automated
```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

### Manual
- **Phase 1**: N/A (pure library code)
- **Phase 2**: Log in via GitHub OAuth → verify contact appears in Resend dashboard
- **Phase 3**: N/A (library + migration, no UI)
- **Phase 4**: Visit `/admin` → Campaigns tab → create campaign → preview → send test

# Phase 3: Campaign Engine & Announcement Template [batch-eligible with Phase 2]

## Goal

Campaign CRUD with daily-batched sending (Free plan: 100/day), plus a developer-aesthetic announcement email template.

---

## 1. Database Schema

**File**: `supabase/migrations/016_create_email_campaigns.sql` (new)

```sql
-- Campaign metadata
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  headline TEXT NOT NULL,
  body_text TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,   -- array of { text: string } feature bullets
  cta_text TEXT NOT NULL DEFAULT 'See What''s New',
  cta_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | sending | sent | failed
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Per-recipient send tracking
CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  sent_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(campaign_id, handle)
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign_status
  ON campaign_sends(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status
  ON email_campaigns(status);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
```

---

## 2. Campaign DB Access Layer

**File**: `apps/web/lib/db/campaigns.ts` (new)

### Types

```pseudo
export interface Campaign {
  id: string
  name: string
  subject: string
  previewText: string | null
  headline: string
  bodyText: string
  features: { text: string }[]
  ctaText: string
  ctaUrl: string
  status: "draft" | "sending" | "sent" | "failed"
  totalRecipients: number
  sentCount: number
  failedCount: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface CampaignSend {
  id: string
  campaignId: string
  handle: string
  email: string
  status: "pending" | "sent" | "failed"
  sentAt: string | null
  error: string | null
}
```

### Functions

```pseudo
export async function dbGetCampaigns(): Promise<Campaign[]>
  // Query email_campaigns ordered by created_at DESC
  // Fail-open: return [] on error

export async function dbGetCampaign(id: string): Promise<Campaign | null>
  // Query single campaign by UUID
  // Fail-open: return null on error

export async function dbCreateCampaign(campaign: Omit<Campaign, "id" | "status" | "totalRecipients" | "sentCount" | "failedCount" | "createdAt" | "startedAt" | "completedAt">): Promise<string | null>
  // Insert new campaign, return UUID
  // Fail-open: return null on error

export async function dbUpdateCampaign(id: string, updates: Partial<Pick<Campaign, "name" | "subject" | "previewText" | "headline" | "bodyText" | "features" | "ctaText" | "ctaUrl" | "status" | "totalRecipients" | "sentCount" | "failedCount" | "startedAt" | "completedAt">>): Promise<boolean>
  // Update campaign fields
  // Return true on success, false on failure

export async function dbDeleteCampaign(id: string): Promise<boolean>
  // Delete campaign (cascades to campaign_sends)
  // Only allow deletion of draft campaigns
  // Return true on success

export async function dbCreateCampaignSends(campaignId: string, recipients: { handle: string; email: string }[]): Promise<number>
  // Bulk insert campaign_sends rows with status='pending'
  // Return count of inserted rows
  // Use Supabase upsert with onConflict to handle retries

export async function dbGetPendingSends(campaignId: string, limit: number): Promise<CampaignSend[]>
  // Query campaign_sends WHERE status='pending' LIMIT N
  // Order by id for deterministic batching

export async function dbMarkSendsSent(ids: string[]): Promise<void>
  // Update status='sent', sent_at=now() for given IDs

export async function dbMarkSendsFailed(ids: string[], error: string): Promise<void>
  // Update status='failed', error=error for given IDs

export async function dbGetCampaignStats(id: string): Promise<{ sent: number; pending: number; failed: number }>
  // Aggregate counts from campaign_sends grouped by status
```

---

## 3. Campaign Logic Layer

**File**: `apps/web/lib/email/campaigns.ts` (new)

### Constants

```pseudo
DAILY_SEND_LIMIT = 95   // Stay under 100 Free plan limit (5 buffer for transactional)
BATCH_SIZE = 50          // Max per resend.batch.send() call (under 100 API limit)
DAILY_QUOTA_KEY = "campaign:daily-sends"  // Redis counter, reset daily
```

### `initiateCampaign(campaignId: string): Promise<{ totalRecipients: number } | null>`

Populates the campaign_sends table with all eligible recipients and sets status to "sending".

```pseudo
export async function initiateCampaign(campaignId: string)
  campaign = await dbGetCampaign(campaignId)
  if !campaign || campaign.status !== "draft" → return null

  // Get all eligible users
  users = await dbGetUsersWithEmail()
  if users.length === 0 → return null

  // Insert send records
  count = await dbCreateCampaignSends(campaignId, users.map(u → ({
    handle: u.handle,
    email: u.email,
  })))

  // Update campaign status
  await dbUpdateCampaign(campaignId, {
    status: "sending",
    totalRecipients: count,
    startedAt: new Date().toISOString(),
  })

  return { totalRecipients: count }
```

### `processCampaignBatch(campaignId: string): Promise<{ sent: number; failed: number; remaining: number }>`

Sends the next batch of pending emails for a campaign. Called by the daily cron.

```pseudo
export async function processCampaignBatch(campaignId: string)
  campaign = await dbGetCampaign(campaignId)
  if !campaign || campaign.status !== "sending" → return { sent: 0, failed: 0, remaining: 0 }

  // Check daily quota
  todaySent = await getDailyQuota()
  available = DAILY_SEND_LIMIT - todaySent
  if available <= 0 → return { sent: 0, failed: 0, remaining: -1 }  // quota exhausted

  // Get next batch of pending sends
  batchLimit = Math.min(available, BATCH_SIZE)
  pending = await dbGetPendingSends(campaignId, batchLimit)
  if pending.length === 0 →
    // All sends processed — mark campaign complete
    stats = await dbGetCampaignStats(campaignId)
    finalStatus = stats.failed > 0 && stats.sent === 0 ? "failed" : "sent"
    await dbUpdateCampaign(campaignId, {
      status: finalStatus,
      sentCount: stats.sent,
      failedCount: stats.failed,
      completedAt: new Date().toISOString(),
    })
    return { sent: 0, failed: 0, remaining: 0 }

  // Build emails for batch
  resend = getResend()
  if !resend → return { sent: 0, failed: pending.length, remaining: pending.length }

  emails = pending.map(send → ({
    from: "Chapa <notifications@chapa.thecreativetoken.com>",
    to: send.email,
    subject: campaign.subject,
    html: buildAnnouncementHtml({ ...campaign, handle: send.handle }),
    text: buildAnnouncementText({ ...campaign, handle: send.handle }),
  }))

  // Send batch
  { data, error } = await resend.batch.send(emails)

  if error →
    await dbMarkSendsFailed(pending.map(s → s.id), error.message)
    return { sent: 0, failed: pending.length, remaining: ... }

  // Mark successful, increment daily counter
  await dbMarkSendsSent(pending.map(s → s.id))
  await incrementDailyQuota(pending.length)

  // Update campaign counts
  stats = await dbGetCampaignStats(campaignId)
  await dbUpdateCampaign(campaignId, {
    sentCount: stats.sent,
    failedCount: stats.failed,
  })

  return { sent: pending.length, failed: 0, remaining: stats.pending }
```

### `getDailyQuota(): Promise<number>`

Redis counter for today's send count:

```pseudo
async function getDailyQuota(): Promise<number>
  key = `${DAILY_QUOTA_KEY}:${todayDateString()}`
  count = await cacheGet(key)
  return count ? parseInt(count) : 0

async function incrementDailyQuota(count: number): Promise<void>
  key = `${DAILY_QUOTA_KEY}:${todayDateString()}`
  // Redis INCRBY + set TTL 86400 if new key
  await cacheIncr(key, count, 86400)
```

**Note**: Need to add `cacheIncr()` to `redis.ts` if it doesn't exist — simple INCRBY wrapper.

---

## 4. Announcement Email Template

**File**: `apps/web/lib/email/templates/announcement.ts` (new)

### Design

Developer-first aesthetic matching the site:
- Dark background (`#0A0A0F`)
- Card surface (`#111118`)
- JetBrains Mono for headings (with monospace fallback — email clients may not load web fonts)
- Plus Jakarta Sans for body (with sans-serif fallback)
- Purple accent (`#8B5CF6`) for CTA and highlights
- Minimal structure: greeting → headline → body → feature bullets → CTA → footer + unsubscribe
- No images, no GIFs, no animations

### Template Data

```pseudo
export interface AnnouncementData {
  handle: string
  headline: string
  bodyText: string
  features: { text: string }[]
  ctaText: string
  ctaUrl: string
  previewText?: string
}
```

### `buildAnnouncementHtml(data: AnnouncementData): string`

```pseudo
export function buildAnnouncementHtml(data: AnnouncementData): string
  handle = escapeHtml(data.handle)
  headline = escapeHtml(data.headline)
  bodyText = escapeHtml(data.bodyText)
  ctaText = escapeHtml(data.ctaText)
  ctaUrl = escapeHtml(data.ctaUrl)
  unsubscribeUrl = escapeHtml(`${baseUrl}/api/notifications/unsubscribe?handle=${data.handle}`)

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${data.previewText ? `<meta name="description" content="${escapeHtml(data.previewText)}">` : ""}
    <!--[if !mso]><!-->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap');
    </style>
    <!--<![endif]-->
  </head>
  <body style="margin:0; padding:0; background:#0A0A0F; font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <!-- Preheader text (hidden) -->
    ${data.previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(data.previewText)}</div>` : ""}

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;">
      <tr><td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Logo -->
          <tr><td style="padding-bottom:24px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#8B5CF6;letter-spacing:0.05em;">
              CHAPA_
            </span>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding-bottom:32px;">
            <div style="height:1px;background:rgba(139,92,246,0.15);"></div>
          </td></tr>

          <!-- Greeting -->
          <tr><td style="padding-bottom:16px;">
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;color:#8B8FA0;">
              Hey @${handle},
            </span>
          </td></tr>

          <!-- Headline -->
          <tr><td style="padding-bottom:16px;">
            <h1 style="margin:0;font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:#E2E4E9;line-height:1.3;">
              ${headline}
            </h1>
          </td></tr>

          <!-- Body -->
          <tr><td style="padding-bottom:24px;">
            <p style="margin:0;font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;color:#8B8FA0;line-height:1.6;">
              ${bodyText}
            </p>
          </td></tr>

          <!-- Feature bullets -->
          ${data.features.map(f => `
          <tr><td style="padding-bottom:8px;padding-left:8px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#8B5CF6;">→</span>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;color:#E2E4E9;padding-left:8px;">
              ${escapeHtml(f.text)}
            </span>
          </td></tr>
          `).join("")}

          <!-- Spacer before CTA -->
          <tr><td style="padding-top:24px;padding-bottom:32px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:#8B5CF6;color:#FFFFFF;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
              ${ctaText}
            </a>
          </td></tr>

          <!-- Footer divider -->
          <tr><td style="padding-bottom:16px;">
            <div style="height:1px;background:rgba(139,92,246,0.10);"></div>
          </td></tr>

          <!-- Footer -->
          <tr><td>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#4A4A5E;">
              chapa.thecreativetoken.com
            </span>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#4A4A5E;padding-left:12px;">
              ·
            </span>
            <a href="${unsubscribeUrl}" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:#4A4A5E;text-decoration:underline;padding-left:12px;">
              Unsubscribe
            </a>
          </td></tr>

        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `
```

### `buildAnnouncementText(data: AnnouncementData): string`

```pseudo
export function buildAnnouncementText(data: AnnouncementData): string
  lines = [
    `CHAPA`,
    `─────`,
    ``,
    `Hey @${data.handle},`,
    ``,
    data.headline,
    ``,
    data.bodyText,
    ``,
    ...data.features.map(f → `→ ${f.text}`),
    ``,
    `${data.ctaText}: ${data.ctaUrl}`,
    ``,
    `─────`,
    `chapa.thecreativetoken.com`,
    `Unsubscribe: ${baseUrl}/api/notifications/unsubscribe?handle=${data.handle}`,
  ]
  return lines.join("\n")
```

---

## 5. Campaign Processing Cron

**File**: `apps/web/app/api/cron/process-campaigns/route.ts` (new)

### Route: `GET /api/cron/process-campaigns`

Auth: Bearer token via `CRON_SECRET` (same as warm-cache).

```pseudo
export async function GET(request: NextRequest)
  // 1. Auth (same pattern as warm-cache)
  ... CRON_SECRET verification ...

  // 2. Find active campaigns (status = 'sending')
  campaigns = await dbGetCampaigns()
  active = campaigns.filter(c → c.status === "sending")

  if active.length === 0 →
    return { status: "idle", message: "No active campaigns" }

  // 3. Process first active campaign (one at a time to respect daily limits)
  campaign = active[0]
  result = await processCampaignBatch(campaign.id)

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    ...result,
  }
```

**Schedule**: Daily at 8:00 AM UTC (user-facing email at a reasonable hour):

```json
{
  "path": "/api/cron/process-campaigns",
  "schedule": "0 8 * * *"
}
```

---

## 6. Redis Helper: `cacheIncr`

**File**: `apps/web/lib/cache/redis.ts` (modify)

Add a new helper for atomic increment with TTL:

```pseudo
export async function cacheIncr(key: string, amount: number = 1, ttl?: number): Promise<number>
  redis = getRedis()
  if !redis → return 0

  try
    // Upstash: pipeline INCRBY + conditional EXPIRE
    const pipeline = redis.pipeline()
    pipeline.incrby(key, amount)
    if (ttl) pipeline.expire(key, ttl)
    const results = await pipeline.exec()
    return results[0] as number
  catch
    console.error(...)
    return 0
```

---

## 7. Tests

### `apps/web/lib/email/campaigns.test.ts` (new)

**Test cases**:

1. `initiateCampaign` — creates sends for all eligible users
2. `initiateCampaign` — returns null for non-draft campaigns
3. `initiateCampaign` — returns null when no eligible users
4. `processCampaignBatch` — sends batch and marks sends as sent
5. `processCampaignBatch` — respects daily quota limit
6. `processCampaignBatch` — marks campaign as "sent" when all sends processed
7. `processCampaignBatch` — marks campaign as "failed" when all sends failed
8. `processCampaignBatch` — handles partial batch failure
9. `processCampaignBatch` — returns early when Resend unavailable
10. `getDailyQuota` — returns 0 when no sends today
11. `getDailyQuota` — returns correct count from Redis

### `apps/web/lib/email/templates/announcement.test.ts` (new)

**Test cases**:

1. `buildAnnouncementHtml` — includes escaped handle, headline, body
2. `buildAnnouncementHtml` — includes feature bullets with arrow prefix
3. `buildAnnouncementHtml` — includes CTA button with correct URL
4. `buildAnnouncementHtml` — includes unsubscribe link in footer
5. `buildAnnouncementHtml` — escapes XSS in all user-controlled fields
6. `buildAnnouncementHtml` — includes preview text when provided
7. `buildAnnouncementHtml` — omits preview text when not provided
8. `buildAnnouncementText` — includes all sections in plain text
9. `buildAnnouncementText` — includes unsubscribe URL

### `apps/web/lib/db/campaigns.test.ts` (new)

**Test cases**:

1. `dbCreateCampaign` — creates and returns UUID
2. `dbGetCampaigns` — returns all campaigns ordered by creation
3. `dbGetCampaign` — returns single campaign by ID
4. `dbGetCampaign` — returns null for non-existent ID
5. `dbUpdateCampaign` — updates specified fields
6. `dbDeleteCampaign` — deletes draft campaign
7. `dbDeleteCampaign` — rejects deletion of non-draft campaign
8. `dbCreateCampaignSends` — bulk inserts pending sends
9. `dbGetPendingSends` — returns pending sends with limit
10. `dbMarkSendsSent` — updates status and timestamp
11. `dbMarkSendsFailed` — updates status and error message
12. `dbGetCampaignStats` — returns correct counts by status
13. All functions return defaults when DB unavailable

### `apps/web/app/api/cron/process-campaigns/route.test.ts` (new)

**Test cases**:

1. Returns 401 without valid CRON_SECRET
2. Returns idle when no active campaigns
3. Processes first active campaign batch
4. Returns correct send/fail/remaining counts

---

## Success Criteria

### Automated
- All new tests pass
- `pnpm run typecheck` clean
- `pnpm run lint` clean
- Migration applies cleanly

### Manual
- None (no UI in this phase)

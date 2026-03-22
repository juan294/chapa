# Phase 1: Schema + Backend

## Migration

**File:** `supabase/migrations/017_add_campaign_type.sql` (NEW)

```sql
ALTER TABLE email_campaigns
  ADD COLUMN type TEXT NOT NULL DEFAULT 'announcement';

CREATE INDEX IF NOT EXISTS idx_email_campaigns_type
  ON email_campaigns(type);
```

Apply via `supabase db push --linked`.

## Campaign interface

**File:** `apps/web/lib/db/campaigns.ts`

Add `type` to Campaign interface:

```pseudo
interface Campaign {
  ...existing fields...
+ type: "announcement" | "engagement";
}
```

Update `mapCampaignRow`:
```pseudo
+ type: row.type ?? "announcement",
```

Update `dbCreateCampaign` — accept `type` in input, include in insert:
```pseudo
dbCreateCampaign(campaign: Omit<Campaign, "id" | "status" | ...>)
  insert: { ...existing, type: campaign.type }
```

Add new query helper:
```pseudo
export async function dbGetActiveEngagementCampaign(): Promise<Campaign | null> {
  // Get most recently created engagement campaign (any status — it's a template)
  query: from("email_campaigns")
    .select("*")
    .eq("type", "engagement")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
}
```

## Campaign creation API

**File:** `apps/web/app/api/admin/campaigns/route.ts`

POST handler:
```pseudo
+ accept optional `type` field from body (default "announcement")
+ validate type is "announcement" | "engagement"
+ pass to dbCreateCampaign
```

GET handler:
```pseudo
+ accept optional `type` query param for filtering
+ pass to dbGetCampaigns(status, type) or filter in JS
```

## Send route guard

**File:** `apps/web/app/api/admin/campaigns/[id]/send/route.ts`

```pseudo
+ if (campaign.type === "engagement") {
+   return 400 "Engagement campaigns are sent automatically"
+ }
```

## Tests

Update existing tests:
- Campaign CRUD tests: verify `type` field persists
- Send route test: add test for engagement campaign rejection
- GET route test: verify type filtering

## Verification

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
supabase db push --linked  # apply migration
```

# Phase 4: Admin Campaigns Dashboard

## Goal

Admin UI tab to create, preview, and send campaigns. Integrates with the campaign engine from Phase 3.

---

## 1. Admin Types — Add Campaigns Tab

**File**: `apps/web/app/admin/admin-types.ts` (modify)

```pseudo
// Add "campaigns" to AdminTab union type
export type AdminTab = "users" | "agents" | "engagement" | "campaigns"
```

---

## 2. Admin Dashboard Hook — Handle Campaigns Tab

**File**: `apps/web/app/admin/useAdminDashboard.ts` (modify)

Add "campaigns" to the tab event listener and any tab-related logic.

---

## 3. Admin Dashboard Client — Add Tab

**File**: `apps/web/app/admin/AdminDashboardClient.tsx` (modify)

```pseudo
// 1. Dynamic import for CampaignsDashboard (same pattern as AgentsDashboard)
const CampaignsDashboard = dynamic(
  () => import("./campaigns/campaigns-dashboard").then(m => m.CampaignsDashboard),
  { ssr: false }
)

// 2. Add tab button (after Engagement tab, ~line 83-92)
<button
  className={tabClasses("campaigns")}
  onClick={() => setActiveTab("campaigns")}
>
  /campaigns
</button>

// 3. Add tab content pane (after engagement content, ~line 153-160)
{activeTab === "campaigns" && <CampaignsDashboard />}
```

---

## 4. Campaigns Dashboard Component

**File**: `apps/web/app/admin/campaigns/campaigns-dashboard.tsx` (new)

### State

```pseudo
campaigns: Campaign[]
loading: boolean
error: string | null
selectedCampaign: Campaign | null
mode: "list" | "create" | "detail"  // view states
```

### Views

#### List View (`mode === "list"`)

```pseudo
<section>
  <header: "Email Campaigns" + "New Campaign" button>

  <table>
    <thead: Name | Status | Recipients | Sent | Created>
    <tbody>
      {campaigns.map(c → (
        <tr onClick → setSelectedCampaign(c), setMode("detail")>
          <td>{c.name}</td>
          <td><StatusBadge status={c.status} /></td>
          <td>{c.totalRecipients}</td>
          <td>{c.sentCount} / {c.totalRecipients}</td>
          <td>{formatDate(c.createdAt)}</td>
        </tr>
      ))}
    </tbody>
  </table>

  {campaigns.length === 0 && <EmptyState: "No campaigns yet" />}
</section>
```

#### Create View (`mode === "create"`)

Form with fields matching the campaign schema:

```pseudo
<form onSubmit={handleCreate}>
  <input name="name" label="Campaign Name" placeholder="March 2026 Update" />
  <input name="subject" label="Email Subject" placeholder="What's new in Chapa" />
  <input name="previewText" label="Preview Text" placeholder="(optional) shown in inbox preview" />
  <input name="headline" label="Headline" placeholder="Your dashboard just got better" />
  <textarea name="bodyText" label="Body" placeholder="Short paragraph..." rows={3} />

  <fieldset label="Feature Highlights">
    {features.map((f, i) → (
      <div>
        <input value={f.text} onChange={...} placeholder="Feature description" />
        <button onClick → removeFeature(i)>×</button>
      </div>
    ))}
    <button onClick → addFeature()>+ Add feature</button>
  </fieldset>

  <input name="ctaText" label="CTA Button Text" defaultValue="See What's New" />
  <input name="ctaUrl" label="CTA URL" defaultValue="https://chapa.thecreativetoken.com" />

  <div: actions>
    <button type="button" onClick → setMode("list")>Cancel</button>
    <button type="button" onClick → handlePreview()>Preview</button>
    <button type="submit">Create Draft</button>
  </div>
</form>
```

#### Detail View (`mode === "detail"`)

Shows campaign details with actions based on status:

```pseudo
<section>
  <button onClick → setMode("list")>← Back to campaigns</button>

  <h2>{campaign.name}</h2>
  <StatusBadge status={campaign.status} />

  <dl: campaign metadata>
    Subject: {campaign.subject}
    Headline: {campaign.headline}
    Created: {formatDate(campaign.createdAt)}
    {campaign.startedAt && Started: {formatDate(campaign.startedAt)}}
    {campaign.completedAt && Completed: {formatDate(campaign.completedAt)}}
  </dl>

  <div: progress>
    {campaign.status === "sending" && (
      <ProgressBar value={campaign.sentCount} max={campaign.totalRecipients} />
      <p>{campaign.sentCount} / {campaign.totalRecipients} sent ({campaign.failedCount} failed)</p>
      <p: "Sends up to 95 emails/day (Free plan). Processing continues daily.">
    )}
  </div>

  <div: actions>
    {campaign.status === "draft" && (
      <>
        <button onClick → handlePreview()>Preview Email</button>
        <button onClick → handleSend()>Send Campaign</button>
        <button onClick → handleDelete() className="text-terminal-red">Delete</button>
      </>
    )}
  </div>

  <!-- Preview iframe (shown when preview active) -->
  {previewHtml && (
    <iframe srcDoc={previewHtml} className="w-full h-[600px] rounded-xl border border-stroke" />
  )}
</section>
```

### Styling

Follow admin dashboard patterns:
- Terminal aesthetic with `font-heading` for headers
- `bg-card`, `border-stroke`, `text-text-primary/secondary` tokens
- Purple accent on CTAs (`bg-amber`, `text-white`)
- Status badges: draft (gray), sending (amber pulse), sent (green), failed (red)
- Form inputs: dark background (`bg-bg`), `border-stroke`, `focus:border-amber`

---

## 5. Campaign API Routes

### `GET /api/admin/campaigns` — List all campaigns

**File**: `apps/web/app/api/admin/campaigns/route.ts` (new)

```pseudo
export async function GET(request: NextRequest)
  // Admin auth (same pattern as feature-flags)
  ... rate limit, session, isAdminHandle checks ...

  campaigns = await dbGetCampaigns()
  return NextResponse.json({ campaigns })
```

### `POST /api/admin/campaigns` — Create draft campaign

```pseudo
export async function POST(request: NextRequest)
  // Admin auth
  ... rate limit, session, isAdminHandle checks ...

  body = await request.json()
  // Validate required fields: name, subject, headline, bodyText, ctaText, ctaUrl
  if missing → return 400

  id = await dbCreateCampaign({
    name: body.name,
    subject: body.subject,
    previewText: body.previewText ?? null,
    headline: body.headline,
    bodyText: body.bodyText,
    features: body.features ?? [],
    ctaText: body.ctaText,
    ctaUrl: body.ctaUrl,
  })

  if !id → return 500
  return NextResponse.json({ id }, { status: 201 })
```

### `GET /api/admin/campaigns/[id]` — Get campaign detail

**File**: `apps/web/app/api/admin/campaigns/[id]/route.ts` (new)

```pseudo
export async function GET(request, { params })
  // Admin auth
  campaign = await dbGetCampaign(params.id)
  if !campaign → return 404
  return NextResponse.json({ campaign })
```

### `PATCH /api/admin/campaigns/[id]` — Update draft campaign

```pseudo
export async function PATCH(request, { params })
  // Admin auth
  campaign = await dbGetCampaign(params.id)
  if !campaign → return 404
  if campaign.status !== "draft" → return 400 "Can only edit draft campaigns"

  body = await request.json()
  ok = await dbUpdateCampaign(params.id, body)
  if !ok → return 500
  return NextResponse.json({ success: true })
```

### `DELETE /api/admin/campaigns/[id]` — Delete draft campaign

```pseudo
export async function DELETE(request, { params })
  // Admin auth
  ok = await dbDeleteCampaign(params.id)
  if !ok → return 400 "Can only delete draft campaigns"
  return NextResponse.json({ success: true })
```

### `POST /api/admin/campaigns/[id]/send` — Initiate sending

**File**: `apps/web/app/api/admin/campaigns/[id]/send/route.ts` (new)

```pseudo
export async function POST(request, { params })
  // Admin auth
  campaign = await dbGetCampaign(params.id)
  if !campaign → return 404
  if campaign.status !== "draft" → return 400 "Campaign already started"

  result = await initiateCampaign(params.id)
  if !result → return 500 "Failed to initiate campaign"

  // Process first batch immediately (don't wait for cron)
  batchResult = await processCampaignBatch(params.id)

  return NextResponse.json({
    totalRecipients: result.totalRecipients,
    firstBatch: batchResult,
    message: result.totalRecipients <= 95
      ? "All emails sent"
      : `Sending ${result.totalRecipients} emails in daily batches of 95 (Free plan limit)`,
  })
```

### `GET /api/admin/campaigns/[id]/preview` — Preview rendered email

**File**: `apps/web/app/api/admin/campaigns/[id]/preview/route.ts` (new)

```pseudo
export async function GET(request, { params })
  // Admin auth
  campaign = await dbGetCampaign(params.id)
  if !campaign → return 404

  // Render template with sample data
  html = buildAnnouncementHtml({
    handle: "your-handle",  // placeholder for preview
    headline: campaign.headline,
    bodyText: campaign.bodyText,
    features: campaign.features,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
    previewText: campaign.previewText ?? undefined,
  })

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
```

---

## 6. Vercel Cron Schedule Update

**File**: `vercel.json` (modify)

Add the process-campaigns cron:

```json
{
  "path": "/api/cron/process-campaigns",
  "schedule": "0 8 * * *"
}
```

---

## 7. Tests

### `apps/web/app/admin/campaigns/campaigns-dashboard.test.tsx` (new)

**Test cases**:

1. Renders campaign list on mount
2. Shows empty state when no campaigns
3. "New Campaign" button switches to create view
4. Create form validates required fields
5. Create form submits and returns to list
6. Campaign row click opens detail view
7. Detail view shows campaign metadata
8. Detail view shows send progress for "sending" campaigns
9. Preview button loads preview HTML in iframe
10. Send button triggers send API and shows result
11. Delete button removes draft campaign
12. Status badges show correct colors per status

### `apps/web/app/api/admin/campaigns/route.test.ts` (new)

**Test cases**:

1. GET returns 401 without session
2. GET returns 403 for non-admin user
3. GET returns campaign list
4. POST creates draft campaign with valid data
5. POST returns 400 for missing required fields

### `apps/web/app/api/admin/campaigns/[id]/route.test.ts` (new)

**Test cases**:

1. GET returns campaign by ID
2. GET returns 404 for non-existent ID
3. PATCH updates draft campaign
4. PATCH returns 400 for non-draft campaign
5. DELETE removes draft campaign
6. DELETE returns 400 for non-draft campaign

### `apps/web/app/api/admin/campaigns/[id]/send/route.test.ts` (new)

**Test cases**:

1. Returns 404 for non-existent campaign
2. Returns 400 if campaign is not draft
3. Initiates campaign and processes first batch
4. Returns correct totals and message
5. Message indicates multi-day delivery when recipients > 95

### `apps/web/app/api/admin/campaigns/[id]/preview/route.test.ts` (new)

**Test cases**:

1. Returns rendered HTML for campaign
2. Uses placeholder handle in preview
3. Returns 404 for non-existent campaign
4. Returns Content-Type text/html

---

## Success Criteria

### Automated
- All new + modified tests pass
- `pnpm run typecheck` clean
- `pnpm run lint` clean

### Manual
- Visit `/admin` as admin user → see "Campaigns" tab
- Create a new campaign draft → fills all fields
- Preview campaign → see rendered email in iframe with dark theme
- Send campaign → see "sending" status with progress
- For ≤95 recipients: all sent immediately
- For >95 recipients: message confirms daily batching
- Campaign list shows correct statuses and counts

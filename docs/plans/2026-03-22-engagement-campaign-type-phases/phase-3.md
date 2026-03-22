# Phase 3: UI Updates [batch-eligible]

## Campaigns Dashboard

**File:** `apps/web/app/admin/campaigns/campaigns-dashboard.tsx`

### Type selector in create form

Add `type` to `FormData`:

```pseudo
interface FormData {
  ...existing fields...
+ type: "announcement" | "engagement";
}

const EMPTY_FORM: FormData = {
  ...existing defaults...
+ type: "announcement",
}
```

Add type selector at the top of the create form (radio buttons or dropdown):

```pseudo
<fieldset>
  <legend>Campaign Type</legend>
  <label>
    <input type="radio" value="announcement" checked={form.type === "announcement"}
           onChange={() => updateField("type", "announcement")} />
    Announcement — manual send to all users
  </label>
  <label>
    <input type="radio" value="engagement" checked={form.type === "engagement"}
           onChange={() => updateField("type", "engagement")} />
    Engagement — automated, sent on score bump
  </label>
</fieldset>
```

Include `type` in POST body for `handleCreate`.

### Type badge in list view

Add a type column or badge next to the campaign name:

```pseudo
<td>{c.name}
  {c.type === "engagement" && (
    <span className="ml-2 inline-flex ... bg-complement/10 text-complement text-xs">
      engagement
    </span>
  )}
</td>
```

### Detail view — hide "Send Campaign" for engagement

```pseudo
{c.status === "draft" && (
  <div className="flex gap-3">
    <button onClick={() => handlePreview(c.id)}>Preview Email</button>
    <button onClick={() => openEdit(c)}>Edit Draft</button>
-   <button onClick={() => handleSend(c.id)}>Send Campaign</button>
+   {c.type !== "engagement" && (
+     <button onClick={() => handleSend(c.id)}>Send Campaign</button>
+   )}
    <button onClick={() => handleDelete(c.id)}>Delete</button>
  </div>
)}
```

### Engagement campaign info banner

In the detail view, when `c.type === "engagement"`, show an info line:

```pseudo
{c.type === "engagement" && (
  <div className="rounded-lg border border-complement/20 bg-complement/5 px-4 py-2 text-sm text-complement">
    This template is sent automatically when a user's score increases by 10+ points.
    Enable delivery in the Engagement tab.
  </div>
)}
```

### Placeholder help text

When editing an engagement campaign, show available placeholders below the body textarea:

```pseudo
{(mode === "edit" || mode === "create") && form.type === "engagement" && (
  <p className="text-xs text-text-secondary/60 mt-1">
    Available placeholders: {"{{handle}}"}, {"{{delta}}"}, {"{{tier_from}}"}, {"{{tier_to}}"}, {"{{archetype_from}}"}, {"{{archetype_to}}"}
  </p>
)}
```

## Engagement Dashboard

**File:** `apps/web/app/admin/engagement/engagement-dashboard.tsx`

Add a section below the toggle table showing the active engagement campaign:

```pseudo
// Fetch engagement campaign
const [engagementCampaign, setEngagementCampaign] = useState<Campaign | null>(null)

useEffect(() => {
  fetch("/api/admin/campaigns?type=engagement")
    .then(res => res.json())
    .then(data => setEngagementCampaign(data.campaigns?.[0] ?? null))
}, [])

// Render below toggles:
<div className="rounded-xl border border-stroke bg-card p-4 mt-6">
  <h3 className="font-heading text-sm text-text-secondary mb-3">
    Score Bump Email Template
  </h3>
  {engagementCampaign ? (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-text-primary">{engagementCampaign.name}</p>
        <p className="text-xs text-text-secondary">Subject: {engagementCampaign.subject}</p>
      </div>
      <button onClick={() => /* navigate to campaigns tab with campaign selected */}>
        Edit Template
      </button>
    </div>
  ) : (
    <div>
      <p className="text-sm text-text-secondary">No engagement template created yet.</p>
      <button onClick={() => /* navigate to campaigns tab in create mode with type=engagement */}>
        Create Engagement Template
      </button>
    </div>
  )}
</div>
```

The "Edit Template" and "Create" buttons need to communicate with the parent admin dashboard to switch tabs. Use a callback prop or URL-based navigation.

## Tests

### campaigns-dashboard.test.tsx
- Test that type selector appears in create form
- Test that "Send Campaign" is hidden for engagement campaigns
- Test that engagement info banner appears for engagement campaigns

### engagement-dashboard.test.tsx
- Test that engagement campaign link appears when campaign exists
- Test that "Create Engagement Template" appears when no campaign exists

## Verification

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

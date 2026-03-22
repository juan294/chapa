# Plan: Engagement Campaign Type

> Created: 2026-03-22 | Branch: `develop` | Status: READY

## Goal

Unify email template management so all emails (announcements and engagement/score-bump notifications) are managed through the Campaigns admin UI. The admin can edit, preview, and test engagement emails just like announcement campaigns. The Engagement toggle controls automated delivery; the campaign content is managed in Campaigns.

## Design

### Campaign `type` field

Add `type: "announcement" | "engagement"` to the `email_campaigns` table. Default: `"announcement"`. Existing campaigns are announcements.

### Engagement campaign rules

- **One active engagement campaign at a time.** The cron picks the most recently created engagement campaign in `"draft"` status.
- **No "Send Campaign" button.** Engagement campaigns are never bulk-sent manually — the cron sends them one-at-a-time when score bumps are detected.
- **Same edit/preview/test workflow.** The admin uses the same form, preview iframe, and "Send Test" feature.
- **Status stays `"draft"`.** Engagement campaigns don't transition to "sending"/"sent" — they're templates, not one-shot blasts. The `sentCount`/`totalRecipients` fields are unused.

### Score-bump integration

`notifyScoreBump()` queries the active engagement campaign from the DB. If found, it uses the campaign's subject, headline, bodyText, features, ctaText, and ctaUrl to build the email. Dynamic values (handle, score delta, tier/archetype changes) are interpolated into the template using simple `{{variable}}` placeholders in the bodyText and headline fields.

**Supported placeholders:**
- `{{handle}}` — GitHub handle
- `{{delta}}` — score change (e.g., "+12")
- `{{tier_from}}`, `{{tier_to}}` — tier change values
- `{{archetype_from}}`, `{{archetype_to}}` — archetype change values

**Fallback:** If no engagement campaign exists in the DB, the system falls back to the current hardcoded template (zero disruption).

### Engagement tab changes

The Engagement tab keeps the toggle for `score_notifications`. Below the toggle, it shows a link to the active engagement campaign for quick editing. If no engagement campaign exists yet, it shows a "Create Engagement Template" button.

## Phases

| # | Phase | Depends on | Batch-eligible |
|---|-------|------------|----------------|
| 1 | Schema + Backend | — | No |
| 2 | Score-bump DB integration | 1 | Yes |
| 3 | UI updates | 1 | Yes |

Phases 2 and 3 are **[batch-eligible]** — they touch different files with no overlap.

## Files changed

### Phase 1: Schema + Backend
- `supabase/migrations/017_add_campaign_type.sql` (NEW)
- `apps/web/lib/db/campaigns.ts` (add `type` field to interface + row mapping + query helpers)
- `apps/web/app/api/admin/campaigns/route.ts` (accept `type` in POST, filter by type in GET)
- `apps/web/app/api/admin/campaigns/[id]/send/route.ts` (reject engagement campaigns)
- `apps/web/app/api/admin/campaigns/[id]/route.ts` (allow `type` in PATCH validation — but only for draft)

### Phase 2: Score-bump DB integration
- `apps/web/lib/email/score-bump.ts` (query active engagement campaign, interpolate placeholders, fallback)
- `apps/web/lib/email/score-bump.test.ts` (test DB-backed template, fallback, placeholder interpolation)

### Phase 3: UI updates
- `apps/web/app/admin/campaigns/campaigns-dashboard.tsx` (type selector in create form, hide Send for engagement, type badge in list)
- `apps/web/app/admin/engagement/engagement-dashboard.tsx` (link to active engagement campaign)
- `apps/web/app/admin/campaigns/campaigns-dashboard.test.tsx` (update tests for type)
- `apps/web/app/admin/engagement/engagement-dashboard.test.tsx` (test campaign link)

## Success criteria

### Automated
- All existing tests pass (5694+)
- `pnpm run typecheck` clean
- `pnpm run lint` clean
- New tests cover: engagement campaign CRUD, score-bump DB template lookup, placeholder interpolation, fallback to hardcoded, UI type selector, engagement tab link

### Manual
- Admin can create an engagement campaign, edit it, preview it, send a test email
- Engagement campaign does NOT show "Send Campaign" button
- Engagement toggle on/off does NOT affect campaign content — only delivery
- When toggle is on and a score bump is detected, the cron sends the email using the engagement campaign template

# Phase 2: Score-bump DB Integration [batch-eligible]

## Overview

Replace hardcoded email template in `notifyScoreBump()` with DB-backed engagement campaign template. Support `{{variable}}` placeholders for dynamic content. Fall back to current hardcoded template if no engagement campaign exists.

## Placeholder interpolation

**New helper function** in `score-bump.ts`:

```pseudo
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}
```

**Variables available:**
- `{{handle}}` — lowercase GitHub handle
- `{{delta}}` — "+N" formatted score change
- `{{tier_from}}`, `{{tier_to}}` — tier labels (empty string if no tier change)
- `{{archetype_from}}`, `{{archetype_to}}` — archetype labels (empty string if no change)
- `{{score}}` — current adjusted composite (absolute, not delta)

## notifyScoreBump changes

**File:** `apps/web/lib/email/score-bump.ts`

```pseudo
import { dbGetActiveEngagementCampaign } from "@/lib/db/campaigns"
import { buildAnnouncementHtml, buildAnnouncementText } from "./templates/announcement"
import { buildEmailContent } from "./campaigns"

// After guard checks pass, before building email:
const engagementCampaign = await dbGetActiveEngagementCampaign()

if (engagementCampaign) {
  // Use DB-backed template
  const vars = {
    handle: lowerHandle,
    delta: `+${Math.round(diff.adjustedComposite)}`,
    tier_from: diff.tier?.from ?? "",
    tier_to: diff.tier?.to ?? "",
    archetype_from: diff.archetype?.from ?? "",
    archetype_to: diff.archetype?.to ?? "",
    score: String(Math.round(diff.adjustedComposite)),
  }

  // Interpolate placeholders in campaign fields
  const interpolated = {
    ...engagementCampaign,
    subject: interpolate(engagementCampaign.subject, vars),
    headline: interpolate(engagementCampaign.headline, vars),
    bodyText: interpolate(engagementCampaign.bodyText, vars),
  }

  const content = buildEmailContent(interpolated, lowerHandle)
  subject = interpolated.subject
  html = buildAnnouncementHtml(content)
  text = buildAnnouncementText(content)
} else {
  // Fallback: use hardcoded template (current behavior)
  subject = buildSubject(lowerHandle, diff, significance)
  html = buildHtml({ handle, diff, significance, shareUrl, unsubscribeUrl })
  text = buildText({ handle, diff, significance, shareUrl, unsubscribeUrl })
}
```

Keep all existing `buildSubject`, `buildHtml`, `buildText` functions as private fallbacks — no removal, just conditional use.

## Tests

**File:** `apps/web/lib/email/score-bump.test.ts`

Add new test cases:

```pseudo
describe("DB-backed engagement template", () => {
  it("uses engagement campaign template when one exists", async () => {
    mockDbGetActiveEngagementCampaign.mockResolvedValue({
      subject: "{{handle}}: Your score just jumped {{delta}}!",
      headline: "Your Profile Just Leveled Up!",
      bodyText: "Your impact score increased by {{delta}} points.",
      features: [{ text: "Keep shipping!" }],
      ctaText: "View Your Badge",
      ctaUrl: "https://chapa.thecreativetoken.com/u/{{handle}}",
      ...otherCampaignFields,
    })

    await notifyScoreBump("testuser", makeDiff({ adjustedComposite: 12 }), makeSignificance("score_bump"))

    const call = mockSend.mock.calls[0]![0]
    expect(call.subject).toBe("testuser: Your score just jumped +12!")
    expect(call.html).toContain("Your Profile Just Leveled Up!")
    expect(call.html).toContain("+12 points")
  })

  it("falls back to hardcoded template when no engagement campaign exists", async () => {
    mockDbGetActiveEngagementCampaign.mockResolvedValue(null)

    await notifyScoreBump("testuser", makeDiff({ adjustedComposite: 12 }), makeSignificance("score_bump"))

    expect(mockSend).toHaveBeenCalled()
    const call = mockSend.mock.calls[0]![0]
    expect(call.subject).toContain("testuser")
    expect(call.subject).toContain("+12")
  })

  it("interpolates tier placeholders", async () => {
    mockDbGetActiveEngagementCampaign.mockResolvedValue({
      subject: "{{tier_from}} → {{tier_to}}",
      headline: "Your Profile Just Leveled Up!",
      bodyText: "You went from {{tier_from}} to {{tier_to}} ({{delta}} points).",
      ...
    })

    const diff = makeDiff({
      adjustedComposite: 15,
      tier: { from: "Solid", to: "High" },
    })

    await notifyScoreBump("testuser", diff, makeSignificance("tier_change"))

    const call = mockSend.mock.calls[0]![0]
    expect(call.subject).toBe("Solid → High")
    expect(call.html).toContain("Solid")
    expect(call.html).toContain("High")
  })

  it("handles missing placeholders gracefully (empty string)", async () => {
    mockDbGetActiveEngagementCampaign.mockResolvedValue({
      subject: "Score: {{delta}} — Tier: {{tier_to}}",
      ...
    })

    // No tier change in diff
    await notifyScoreBump("testuser", makeDiff({ adjustedComposite: 12 }), makeSignificance("score_bump"))

    const call = mockSend.mock.calls[0]![0]
    expect(call.subject).toBe("Score: +12 — Tier: ")
  })
})
```

## Verification

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

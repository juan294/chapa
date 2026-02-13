# Chapa Product Spec

## User story
As a developer, I want a **beautiful, embeddable badge** that shows my multi-dimensional Impact v4 Profile and updates automatically, so I can share it on my portfolio, README, or social media.

## Primary UI flow
1) Landing `/`: CTA "Sign in with GitHub" (terminal-first UI)
2) After OAuth: show "Generate badge" and redirect to `/u/:handle`
3) Share page `/u/:handle`:
   - Badge preview (animated SVG with heatmap, radar chart, score ring)
   - Impact v4 summary: 4 dimension scores, archetype, tier, adjusted composite, confidence + reasons
   - Embed code snippets: Markdown + HTML
   - One-click "Share on X" with prefilled copy
4) Creator Studio `/studio`:
   - Terminal-first badge customization (9 visual categories)
   - Live preview updates as settings change
   - Configuration persisted via Redis
5) Public access:
   - Anyone can view `/u/:handle` and `/u/:handle/badge.svg`

## Badge public vs verified
- Public mode: shows available public stats, cached daily.
- Verified mode (OAuth): shows “Verified” stamp + may fetch richer stats with token.

## Public endpoints
- GET `/u/:handle/badge.svg`
  - Returns SVG (1200×630)
  - Cacheable (see CLAUDE.md)
- GET `/u/:handle`
  - HTML share page with badge + details
- GET `/api/verify/:hash`
  - Badge verification endpoint (proves data integrity via HMAC-SHA256)
- POST `/api/supplemental`
  - Upload EMU supplemental stats (CLI tool)
- POST `/api/studio/config`
  - Save/load Creator Studio badge customization

## Data refresh
- Default refresh schedule: once per day per handle.
- Manual refresh button on share page:
  - If cache is fresh: show “Updated recently”
  - If stale: triggers recompute (optional endpoint)

## Metrics displayed (badge)
- Heatmap (13 weeks of daily activity, left column)
- Radar chart (4 dimensions: Building, Guarding, Consistency, Breadth — center column)
- Score ring with adjusted composite score (0-100) + tier (right column)
- Archetype label (Builder, Guardian, Marathoner, Polymath, Balanced, Emerging)
- Stars, forks, watchers metric pills
- Impact tier (Emerging/Solid/High/Elite)

Optional display:
- Verified stamp (via OAuth)
- Verification strip (HMAC hash + date on right edge)

## Virality features
- Embed snippet generation
- Share-on-X prefilled message
- Nice OG meta on share page

## Analytics events (PostHog)
- auth_success
- badge_generated (first time per handle)
- badge_svg_hit (sampled)
- embed_copy_markdown
- embed_copy_html
- share_click_x

## Impact v4 Profile

The badge and share page display a multi-dimensional developer profile:

- **4 dimensions** (each 0-100): Building, Guarding, Consistency, Breadth
- **Archetype**: Derived from dimension shape (Builder, Guardian, Marathoner, Polymath, Balanced, Emerging)
- **Composite score**: Average of all four dimensions
- **Confidence** (50-100): Signal clarity rating with transparent, non-accusatory explanations
- **Adjusted score**: Composite gently weighted by confidence
- **Tier**: Emerging (0-39), Solid (40-69), High (70-84), Elite (85-100)

Full scoring spec: `docs/impact-v4.md`

## Non-goals
- No leaderboard
- No org/team pages
- No pricing
- No long-term history timeline
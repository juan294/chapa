# Chapa Product Spec

## User story
As a developer, I want a **beautiful, embeddable badge** that shows my multi-dimensional Impact v6 Profile and updates automatically, so I can share it on my portfolio, README, or social media.

## Primary UI flow
1) Landing `/`: CTA "Sign in with GitHub" (terminal-first UI)
2) After OAuth: show "Generate badge" and redirect to `/u/:handle`
3) Share page `/u/:handle`:
   - Badge preview (animated SVG with heatmap, radar chart, score ring)
   - Impact v6 summary: 4–5 dimension scores, archetype, tier, adjusted composite, confidence + reasons
   - Embed code snippets: Markdown + HTML
   - One-click "Share on X" with prefilled copy
4) Creator Studio `/studio`:
   - Terminal-first Studio preview customization (9 visual categories)
   - Live preview updates as settings change
   - Configuration persisted in Supabase (`studio_configs`, source of truth) with Redis as a cached payload layer (#935, migration 027); migration 035 adds database-ordered revisions that validate cache hits and preserve cross-instance consistency
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
- GET|PUT `/api/studio/config`
  - Load/save Creator Studio preview configuration (GET to load, PUT to save)
- GET `/api/history/:handle`
  - Score history, trend analysis, and snapshot diffs (public, rate-limited)
- GET `/api/profile/:handle`
  - Public impact profile snapshot (rate-limited, CORS-enabled)
- GET `/api/health`
  - Health check (Redis dbsize + Supabase query, rate-limited)

## Data refresh
- Default refresh schedule: once per day per handle.
- Manual refresh button on share page:
  - If cache is fresh: show “Updated recently”
  - If stale: triggers recompute (optional endpoint)

## Metrics displayed (badge)
- Heatmap (13 weeks of daily activity, left column)
- Radar chart (4–5 dimensions: Delivery, Quality, Consistency, Breadth + optional Craft — pentagon when Craft present, diamond fallback)
- Score ring with adjusted composite score (0-100) + tier (right column)
- Archetype label (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)
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

## Impact v6 Profile

The badge and share page display a multi-dimensional developer profile:

- **4–5 dimensions** (each 0-100): Delivery, Quality, Consistency, Breadth + optional Craft (AI tool insights)
- **Archetype**: Derived from dimension shape (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)
- **Composite score**: Average of all active dimensions (4 or 5 when Craft is present; quality excluded for solo profiles)
- **Confidence** (50-100): Signal clarity rating with transparent, non-accusatory explanations
- **Adjusted score**: Composite gently weighted by confidence
- **Tier**: Emerging (0-39), Solid (40-69), High (70-84), Elite (85-100)

Full scoring spec: `docs/impact-v6.md`

## Non-goals
- No leaderboard
- No org/team pages
- No pricing
- No history UI (score trend data is captured and queryable via API, but no charts or timeline yet)

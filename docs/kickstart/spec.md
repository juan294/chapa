# Chapa Product Spec

## User story
As a developer, I want a **beautiful, embeddable badge** that shows my real contribution impact and updates automatically, so I can share it on my portfolio, README, or social media.

## Primary UI flow
1) Landing `/`: CTA “Sign in with GitHub”
2) After OAuth: show “Generate badge” and redirect to `/u/:handle`
3) Share page `/u/:handle`:
   - Badge preview (animated)
   - Impact summary: tier, adjusted score, confidence + reasons
   - Embed code snippets: Markdown + HTML
   - One-click “Share on X” with prefilled copy
4) Public access:
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

## Data refresh
- Default refresh schedule: once per day per handle.
- Manual refresh button on share page:
  - If cache is fresh: show “Updated recently”
  - If stale: triggers recompute (optional endpoint)

## Metrics displayed (badge)
- Commits (90d)
- PRs merged (90d)
- Reviews (90d)
- Impact tier (Emerging/Solid/High/Elite)
- Adjusted score (0–100)
- Confidence (50–100)

Optional display:
- Lines changed (add+del)
- Verified stamp

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

## Non-goals
- No leaderboard
- No org/team pages
- No pricing
- No long-term history timeline
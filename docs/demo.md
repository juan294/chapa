# Chapa Demo Script (2–3 minutes)

## Demo goal
Show that Chapa turns GitHub activity into a **beautiful, live, embeddable, animated SVG badge** with an **Impact v4 Profile** (4 dimensions + archetype + tier) that updates automatically and is easy to customize and share.

## 10-second opener (hook)
"Developers already have GitHub graphs—but they're not embeddable, not beautiful, and they don't tell an impact story. Chapa generates a live badge you can embed anywhere, with a multi-dimensional Impact Profile that discourages gaming."

## Key highlights
- Live endpoint: `/u/:handle/badge.svg`
- Animated SVG (web-native)
- Impact v4 = 4 dimensions (Building, Guarding, Consistency, Breadth) + archetype + tier
- Radar chart visualization of developer strengths
- Creator Studio for badge visual customization
- Verified mode via GitHub OAuth
- Cacheable + fast for real-world usage

## Demo flow (recommended)
### 1) Landing + Auth (20s)
- Open `/`
- Click "Sign in with GitHub"
- Land on your share page: `/u/<your_handle>`

Say:
"OAuth gives us verified mode and reliable API access. The badge itself is public and cacheable."

### 2) The badge (45s)
- Point at the badge:
  - heatmap (left column, 13 weeks of activity)
  - radar chart (4 dimensions: Building, Guarding, Consistency, Breadth)
  - archetype label (e.g. Builder, Guardian, Marathoner, Polymath)
  - adjusted composite score + tier (Emerging/Solid/High/Elite)
  - stars, forks, watchers metrics

Say:
"This isn't just activity. Impact v4 measures four independent dimensions—shipping code, reviewing others, consistency, and cross-project breadth. Your archetype tells you what kind of developer you are. And the radar chart shows your profile shape at a glance."

### 3) Breakdown + tooltips (20s)
- Scroll to breakdown section
- Hover over dimension cards and stat cards to show tooltips
- Hover over badge elements (heatmap, radar, score) for explanations

Say:
"The breakdown shows each dimension score individually — hover any element for an explanation. The four dimensions give granular insight beyond a single number, and tooltips make everything self-explanatory."

### 4) Creator Studio (30s)
- Navigate to `/studio`
- Show the terminal-first interface
- Type `/set bg aurora` → live preview updates
- Type `/preset premium` → full preset applied
- Type `/save` → configuration persists

Say:
"The Creator Studio lets you customize your badge with 9 visual categories—backgrounds, card styles, score effects, heatmap animations, and more. Everything is a terminal command, but mouse controls are there too."

### 5) Embed it anywhere (35s)
- Copy Markdown embed snippet
- Paste into a sample README / MD preview
- Reload preview → badge appears

Say:
"Everything is a URL. It updates daily, stays sharp in any resolution, and it's fast because we cache at the edge."

### 6) Share (15s)
- Click "Share on X"
- Show prefilled post + link back to generator

Say:
"Chapa is viral by design: one beautiful badge leads to another."

## GitHub branding
GitHub branding is included but isolated behind a feature flag (`includeGithubBranding`), so it can be swapped or removed for compliance.

## Scaling
- Daily cache per handle, plus SVG cache
- Rate limits handled by cache fallback
- Upstash Redis + Vercel edge caching

## Closing line (10s)
"Chapa makes impact visible, shareable, and harder to game—so developers can show their craft with pride."

---

## Backup demo (if OAuth breaks)
- Use `/u/<handle>` public mode
- Show cached badge + embed snippet
- Mention verified mode exists when token is available

---

## What to show on screen (checklist)
- [ ] Landing page with CTA
- [ ] OAuth success
- [ ] Share page with badge + breakdown (radar chart, archetype, dimensions, tooltips)
- [ ] Creator Studio — live badge customization
- [ ] Copy embed snippet
- [ ] README embed rendering
- [ ] Share-on-X click

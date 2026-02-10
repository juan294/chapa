# Chapa Hackathon Demo Script (2–3 minutes)

## Demo goal
Show that Chapa turns GitHub activity into a **beautiful, live, embeddable, animated SVG badge** with an **Impact Score v3** (Impact + Confidence) that updates automatically and is easy to share.

## 10-second opener (hook)
“Developers already have GitHub graphs—but they’re not embeddable, not beautiful, and they don’t tell an impact story. Chapa generates a live badge you can embed anywhere, with an Impact Score + Confidence that discourages gaming.”

## What makes it hackathon-worthy
- Live endpoint: `/u/:handle/badge.svg`
- Animated SVG (web-native)
- Impact v3 = score + confidence + neutral reasons
- Verified mode via GitHub OAuth
- Cacheable + fast for real-world usage

## Demo flow (recommended)
### 1) Landing + Auth (20s)
- Open `/`
- Click “Sign in with GitHub”
- Land on your share page: `/u/<your_handle>`

Say:
“OAuth gives us verified mode and reliable API access. The badge itself is public and cacheable.”

### 2) The badge (45s)
- Point at the badge:
  - heatmap
  - tier label (HIGH/ELITE)
  - score + confidence
  - stats (PRs, Reviews, Commits)

Say:
“This isn’t just activity. It’s Impact v3: merges and reviews weigh more than raw commit spam. And we also show confidence—signal strength—without accusing anyone.”

### 3) Confidence + non-toxic explanation (20s)
- Scroll to breakdown
- Show confidence reasons

Say:
“Confidence is not morality. It’s ‘how clear is the signal.’ If activity is bursty or collaboration signals are low, we reduce confidence slightly and explain why.”

### 4) Embed it anywhere (35s)
- Copy Markdown embed snippet
- Paste into a sample README / MD preview
- Reload preview → badge appears

Say:
“Everything is a URL. It updates daily, stays sharp in any resolution, and it’s fast because we cache at the edge.”

### 5) Share (15s)
- Click “Share on X”
- Show prefilled post + link back to generator

Say:
“Chapa is viral by design: one beautiful badge leads to another.”

## If judges ask about GitHub branding
“We’re including GitHub branding for the hackathon. It’s isolated behind a feature flag so it can be swapped or removed for compliance.”

## If judges ask about scaling
- Daily cache per handle, plus SVG cache
- Rate limits handled by cache fallback
- Upstash Redis + Vercel edge caching

## Closing line (10s)
“Chapa makes impact visible, shareable, and harder to game—so developers can show their craft with pride.”

---

## Backup demo (if OAuth breaks)
- Use `/u/<handle>` public mode
- Show cached badge + embed snippet
- Mention verified mode exists when token is available

---

## What to show on screen (checklist)
- [ ] Landing page with CTA
- [ ] OAuth success
- [ ] Share page with badge + breakdown
- [ ] Copy embed snippet
- [ ] README embed rendering
- [ ] Share-on-X click
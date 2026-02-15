# Chapa User Manual

> Terminal-first developer badge customization tool.
> Everything is a slash command. Mouse works too.

---

## Getting Started

Visit `localhost:3001` (dev) or `chapa.thecreativetoken.com` (production).

Most pages have a terminal input bar at the bottom. Type `/` to see available commands. Press Enter to execute.

There are three terminal contexts:
1. **Landing page** (`chapa >`) — navigation commands
2. **Creator Studio** (`studio >`) — badge customization commands
3. **Global command bar** — appears on share pages, about, terms, etc. — navigation + admin commands

---

## Landing Page Commands

The landing page terminal (`chapa >`) handles navigation only.

| Command | What it does |
|---------|-------------|
| `/studio` | Open the Creator Studio |
| `/login` | Sign in with GitHub |
| `/badge <handle>` | View someone's badge share page |
| `/b <handle>` | Shortcut for `/badge` |
| `/about` | Go to the About page |

**Examples:**
```
chapa > /studio
chapa > /login
chapa > /badge juan294
chapa > /b juan294
```

---

## Creator Studio

After logging in, navigate to `/studio`. The layout is two-column:

- **Left:** Live badge preview (updates instantly as you change settings)
- **Right:** Terminal + Quick Controls

The Studio terminal prompt is `studio >`.

### Studio Commands

| Command | What it does |
|---------|-------------|
| `/help` | List all studio commands |
| `/set <category> <value>` | Change a badge effect |
| `/preset <name>` | Apply a full preset |
| `/save` | Save your configuration |
| `/reset` | Reset everything to defaults |
| `/status` | Show your current settings |
| `/embed` | Show embed code (Markdown + HTML) |
| `/share` | Show share links |
| `/clear` | Clear the terminal output |

---

## The `/set` Command

This is the core customization command. It takes a **category alias** and a **value**.

```
/set <category> <value>
```

Type `/set` without arguments to see all categories and their options.

### Categories and Values

#### `bg` (Background)

| Value | Description |
|-------|-------------|
| `solid` | Clean dark background |
| `aurora` | Animated color waves |
| `particles` | Floating sparkle particles |

```
studio > /set bg aurora
studio > /set bg solid
```

#### `card` (Card Style)

| Value | Description |
|-------|-------------|
| `flat` | Solid card surface |
| `frost` | Cool frosted blur |
| `smoke` | Warm smoky blur |
| `crystal` | Clear crystal refraction |
| `aurora-glass` | Color-shifting glass |

```
studio > /set card frost
studio > /set card crystal
```

#### `border` (Border)

| Value | Description |
|-------|-------------|
| `solid-amber` | Subtle amber border |
| `gradient-rotating` | Animated rotating gradient |
| `none` | No border |

```
studio > /set border gradient-rotating
studio > /set border none
```

#### `score` (Score Effect)

| Value | Description |
|-------|-------------|
| `standard` | Plain text score |
| `gold-shimmer` | Shimmering gold gradient |
| `gold-leaf` | Metallic gold leaf texture |
| `chrome` | Polished chrome reflection |
| `embossed` | Raised embossed text |
| `neon-amber` | Glowing neon amber |
| `holographic` | Rainbow holographic shift |

```
studio > /set score gold-shimmer
studio > /set score holographic
```

#### `heatmap` (Heatmap Animation)

| Value | Description |
|-------|-------------|
| `fade-in` | Uniform gentle fade |
| `diagonal` | Top-left to bottom-right wave |
| `ripple` | Expanding from center |
| `scatter` | Random appearance order |
| `cascade` | Column by column reveal |
| `waterfall` | Row by row reveal |

```
studio > /set heatmap ripple
studio > /set heatmap cascade
```

#### `interact` (Interaction)

| Value | Description |
|-------|-------------|
| `static` | No mouse interaction |
| `tilt-3d` | Perspective tilt on hover |
| `holographic` | Rainbow overlay on hover |

```
studio > /set interact tilt-3d
studio > /set interact holographic
```

#### `stats` (Stats Display)

| Value | Description |
|-------|-------------|
| `static` | Plain numbers |
| `animated-ease` | Smooth counting animation |
| `animated-spring` | Bouncy spring animation |

```
studio > /set stats animated-spring
studio > /set stats static
```

#### `tier` (Tier Treatment)

| Value | Description |
|-------|-------------|
| `standard` | Simple tier pill |
| `enhanced` | Sparkle dots for high tiers |

```
studio > /set tier enhanced
```

#### `celebrate` (Celebration)

| Value | Description |
|-------|-------------|
| `none` | No celebration effect |
| `confetti` | Burst of confetti on load |

```
studio > /set celebrate confetti
studio > /set celebrate none
```

### Category Alias Reference

| Alias | Full config key |
|-------|----------------|
| `bg` | `background` |
| `card` | `cardStyle` |
| `border` | `border` |
| `score` | `scoreEffect` |
| `heatmap` | `heatmapAnimation` |
| `interact` | `interaction` |
| `stats` | `statsDisplay` |
| `tier` | `tierTreatment` |
| `celebrate` | `celebration` |

You can use either the alias or the full key name:
```
studio > /set bg aurora
studio > /set background aurora
```

Both work identically.

---

## Presets

Presets apply a full set of effects at once. Great for getting a starting point, then tweaking individual settings.

```
/preset <name>
```

Type `/preset` without arguments to see all available presets.

### Available Presets

#### `minimal` — Minimal
All defaults. Clean and simple.

| Category | Value |
|----------|-------|
| Background | solid |
| Card Style | flat |
| Border | solid-amber |
| Score Effect | standard |
| Heatmap | fade-in |
| Interaction | static |
| Stats Display | static |
| Tier Treatment | standard |
| Celebration | none |

```
studio > /preset minimal
```

#### `premium` — Premium
Rich, warm, animated feel.

| Category | Value |
|----------|-------|
| Background | aurora |
| Card Style | smoke |
| Border | solid-amber |
| Score Effect | gold-leaf |
| Heatmap | diagonal |
| Interaction | tilt-3d |
| Stats Display | animated-ease |
| Tier Treatment | enhanced |
| Celebration | none |

```
studio > /preset premium
```

#### `holographic` — Holographic
Cool, futuristic holographic effects.

| Category | Value |
|----------|-------|
| Background | solid |
| Card Style | frost |
| Border | gradient-rotating |
| Score Effect | gold-shimmer |
| Heatmap | ripple |
| Interaction | holographic |
| Stats Display | animated-ease |
| Tier Treatment | enhanced |
| Celebration | none |

```
studio > /preset holographic
```

#### `maximum` — Maximum
Everything turned up. All effects enabled.

| Category | Value |
|----------|-------|
| Background | aurora |
| Card Style | crystal |
| Border | gradient-rotating |
| Score Effect | gold-shimmer |
| Heatmap | scatter |
| Interaction | tilt-3d |
| Stats Display | animated-spring |
| Tier Treatment | enhanced |
| Celebration | confetti |

```
studio > /preset maximum
```

---

## Saving and Sharing

### Save Your Config

```
studio > /save
```

Persists your badge configuration server-side. Your badge at `/u/<handle>/badge.svg` will reflect the saved settings.

### Check Current Settings

```
studio > /status
```

Displays all 9 categories with their current values.

### Get Embed Code

```
studio > /embed
```

Shows two snippet formats:

**Markdown** (for GitHub README, etc.):
```
![Chapa Badge](https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg)
```

**HTML** (for websites):
```html
<img src="https://chapa.thecreativetoken.com/u/YOUR_HANDLE/badge.svg" alt="Chapa Badge" width="600" />
```

### Get Share Links

```
studio > /share
```

Shows:
- **Direct link** to your share page
- **Badge SVG** URL for embedding

---

## Keyboard Shortcuts

| Key | Where | What it does |
|-----|-------|-------------|
| `Enter` | Terminal input | Execute the typed command |
| `Arrow Up` | Terminal input | Previous command from history |
| `Arrow Down` | Terminal input | Next command in history |
| `Escape` | Terminal input | Clear the input |
| `Tab` | Terminal input (with autocomplete open) | Select the highlighted suggestion |
| `Arrow Up/Down` | Autocomplete dropdown | Navigate between suggestions |
| `Cmd+K` / `Ctrl+K` | Creator Studio, Global command bar | Focus the terminal input |

### Autocomplete

Start typing a `/` command and a dropdown appears with matching commands. Use arrow keys to navigate and Tab or Enter to select.

Commands that need arguments (`/set`, `/preset`) will be inserted into the input with a trailing space so you can continue typing the argument.

---

## Quick Controls (Mouse Fallback)

If you prefer clicking over typing, the Creator Studio has a **Quick Controls** panel.

### How to open it

Click the **"+ Quick Controls"** button at the top of the terminal pane (right side).

### What's inside

1. **Preset buttons** — Click any preset (Minimal, Premium, Holographic, Maximum) to apply it instantly
2. **Category sections** — Click a category name to expand it, then click any option chip to apply it
3. **Save / Reset buttons** — At the bottom of the panel

### How it works

Every click in Quick Controls **executes the equivalent terminal command**. You'll see the command appear in the terminal output. This teaches you the keyboard syntax while using the mouse.

For example, clicking "Aurora Glow" under Background executes `/set bg aurora`.

---

## Global Command Bar

On pages that don't have a dedicated terminal (share pages, about, terms, privacy, archetype pages), a **Global Command Bar** appears at the bottom of the page. It provides navigation and, for admins, dashboard commands.

### Commands

| Command | What it does |
|---------|-------------|
| `/help` | List available commands |
| `/home` | Go to the landing page |
| `/studio` | Open the Creator Studio (if enabled) |
| `/login` | Sign in with GitHub |
| `/badge <handle>` | View someone's badge share page |
| `/b <handle>` | Shortcut for `/badge` |
| `/about` | Go to the About page |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/builder` | View the Builder archetype page |
| `/guardian` | View the Guardian archetype page |
| `/marathoner` | View the Marathoner archetype page |
| `/polymath` | View the Polymath archetype page |
| `/balanced` | View the Balanced archetype page |
| `/emerging` | View the Emerging archetype page |

**Admin-only commands** (visible only to admin handles):

| Command | What it does |
|---------|-------------|
| `/admin` | Navigate to admin dashboard |
| `/refresh` | Refresh dashboard data |
| `/sort <field>` | Sort admin table by field |

---

## Admin Dashboard

The admin dashboard (`/admin`) is available to GitHub handles listed in the `ADMIN_HANDLES` environment variable. It shows a table of all users with their stats, scores, and metadata.

### Features

- **Sortable table** — Click column headers to sort ascending/descending
- **Refresh button** — Manually refresh user data from the server
- **Terminal commands** — The command bar supports admin-specific commands

### `/sort` Command

Sort the user table by any field. Supports short aliases:

| Alias | Sorts by |
|-------|----------|
| `handle` or `name` | GitHub handle |
| `archetype` | Developer archetype |
| `tier` | Impact tier |
| `score` | Adjusted composite score |
| `confidence` or `conf` | Confidence value |
| `commits` | Total commits |
| `prs` | Merged PRs |
| `reviews` | Reviews submitted |
| `days` | Active days |
| `stars` | Total stars |
| `updated` | Last fetched timestamp |

```
/sort score
/sort commits
/sort archetype
```

Repeat the same sort command to toggle between ascending and descending order.

---

## Tooltips

The share page and badge preview include **explanatory tooltips** that appear on hover (desktop) or tap (mobile).

### Badge Tooltips

Hovering over elements on the badge preview reveals explanations:
- **Archetype label** — What this archetype means
- **Heatmap** — How to read the activity grid
- **Radar chart** — What the four dimensions represent
- **Score** — How the composite score is calculated
- **Tier** — What the tier means
- **Stars / Forks / Watchers** — What each community metric represents
- **Verification hash** — What the hash proves

### Breakdown Tooltips

In the impact breakdown section below the badge:
- **Dimension cards** (Building, Guarding, Consistency, Breadth) — Hover for a description of what each dimension measures
- **Stat cards** (commits, PRs, reviews, etc.) — Hover for an explanation of how each stat contributes to the score

Tooltips are accessible via keyboard (Tab + focus) and auto-position to stay within the viewport.

---

## Score History API

Chapa stores daily snapshots of your metrics and provides a public API to query your score history, trends, and changes over time.

### Endpoint

```
GET /api/history/:handle
```

No authentication required — the data is derived from public GitHub activity.

### Query Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `from` | (none) | Start date filter (YYYY-MM-DD) |
| `to` | (none) | End date filter (YYYY-MM-DD) |
| `window` | `7` | Number of recent snapshots for trend analysis (2-30) |
| `include` | `snapshots,trend` | Comma-separated: `snapshots`, `trend`, `diff` |

### Examples

```bash
# Get all snapshots + trend for a user
curl https://chapa.thecreativetoken.com/api/history/juan294

# Get snapshots from a date range
curl "https://chapa.thecreativetoken.com/api/history/juan294?from=2026-01-01&to=2026-02-01"

# Get only trend and diff (no raw snapshots)
curl "https://chapa.thecreativetoken.com/api/history/juan294?include=trend,diff"

# Use a 14-day trend window
curl "https://chapa.thecreativetoken.com/api/history/juan294?window=14"
```

### Response Shape

```json
{
  "handle": "juan294",
  "snapshots": [
    {
      "date": "2026-02-14",
      "capturedAt": "2026-02-14T08:30:00Z",
      "commitsTotal": 342,
      "building": 72,
      "guarding": 45,
      "consistency": 68,
      "breadth": 55,
      "archetype": "Builder",
      "compositeScore": 60,
      "adjustedComposite": 58,
      "confidence": 85,
      "tier": "Solid"
    }
  ],
  "trend": {
    "direction": "improving",
    "windowSize": 7,
    "snapshotCount": 7,
    "compositeAvgDelta": 1.5,
    "compositeValues": [55, 56, 57, 57, 58, 58, 58],
    "dimensions": {
      "building": { "direction": "improving", "avgDelta": 2.0 },
      "guarding": { "direction": "stable", "avgDelta": 0.3 },
      "consistency": { "direction": "improving", "avgDelta": 1.2 },
      "breadth": { "direction": "stable", "avgDelta": -0.1 }
    }
  },
  "diff": {
    "direction": "improving",
    "daysBetween": 1,
    "compositeScore": 2,
    "adjustedComposite": 1,
    "dimensions": {
      "building": 3,
      "guarding": 0,
      "consistency": 2,
      "breadth": 1
    },
    "explanations": [
      "Adjusted composite improved by 1 (57 → 58)",
      "Building improved by 3 (69 → 72)"
    ]
  }
}
```

### Trend Directions

| Direction | Meaning |
|-----------|---------|
| `improving` | Average delta > +1.0 per snapshot |
| `declining` | Average delta < -1.0 per snapshot |
| `stable` | Within ±1.0 per snapshot |

### Rate Limiting

100 requests per IP per 60 seconds. Returns `429 Too Many Requests` with a `Retry-After: 60` header when exceeded.

---

## Testing Walkthrough

Use this checklist to verify every feature works.

### 1. Landing Page Terminal

- [ ] Visit `localhost:3001`
- [ ] See the `chapa >` input fixed at the bottom of the page
- [ ] Type `/studio` and press Enter — navigates to `/studio`
- [ ] Go back to home
- [ ] Type `/login` and press Enter — redirects to GitHub login
- [ ] Go back to home
- [ ] Type `/badge juan294` and press Enter — navigates to `/u/juan294`
- [ ] Go back to home
- [ ] Type `/b juan294` and press Enter — same as above (alias)
- [ ] Type `/about` and press Enter — navigates to `/about`

### 2. Studio — Terminal Commands

- [ ] Navigate to `/studio` (must be logged in)
- [ ] See two-column layout: preview left, terminal right
- [ ] See welcome message: "Creator Studio — customize your badge"
- [ ] Type `/help` — see list of all commands
- [ ] Type `/status` — see current config values for all 9 categories
- [ ] Type `/clear` — terminal output is cleared

### 3. Studio — `/set` Command

- [ ] Type `/set` (no args) — see usage help with all categories and values
- [ ] Type `/set bg aurora` — preview updates to aurora background
- [ ] Type `/set card frost` — preview updates to frosted glass card
- [ ] Type `/set border gradient-rotating` — preview shows rotating gradient border
- [ ] Type `/set score gold-shimmer` — score text gets shimmer effect
- [ ] Type `/set heatmap ripple` — heatmap animates from center
- [ ] Type `/set interact tilt-3d` — hover over preview to see 3D tilt
- [ ] Type `/set stats animated-spring` — stats numbers bounce in
- [ ] Type `/set tier enhanced` — tier pill gets sparkle dots
- [ ] Type `/set celebrate confetti` — confetti bursts on load
- [ ] Type `/set bg invalid` — see error: "Invalid value" with valid options listed
- [ ] Type `/set xyz solid` — see error: "Unknown category" with valid aliases listed

### 4. Studio — Presets

- [ ] Type `/preset` (no args) — see list of all presets
- [ ] Type `/preset minimal` — all effects reset to defaults, preview updates
- [ ] Type `/preset premium` — preview shows rich animated effects
- [ ] Type `/preset holographic` — preview shows holographic effects
- [ ] Type `/preset maximum` — preview shows all effects at once
- [ ] Type `/preset banana` — see error: "Unknown preset"

### 5. Studio — Save, Reset, Embed, Share

- [ ] Type `/save` — see "Saving configuration..." then "Configuration saved!"
- [ ] Type `/reset` — see "Configuration reset to defaults." + preview resets
- [ ] Type `/embed` — see Markdown and HTML embed snippets with your handle
- [ ] Type `/share` — see direct link and badge SVG URL with your handle

### 6. Keyboard Shortcuts

- [ ] Type a command, press Enter — executes
- [ ] Press Arrow Up — recalls last command
- [ ] Press Arrow Up again — recalls command before that
- [ ] Press Arrow Down — moves forward through history
- [ ] Press Arrow Down past most recent — clears input
- [ ] Press Escape — clears input
- [ ] Type `/s` — see autocomplete dropdown (shows /set, /save, /share, /status)
- [ ] Press Arrow Down in dropdown — highlight moves down
- [ ] Press Arrow Up in dropdown — highlight moves up
- [ ] Press Tab or Enter on `/set` — inserts `/set ` (with space) into input
- [ ] Press Tab or Enter on `/save` — executes `/save` immediately
- [ ] Press Cmd+K (Mac) / Ctrl+K (Windows) — terminal input gets focus

### 7. Quick Controls

- [ ] Click "+ Quick Controls" — panel expands
- [ ] Click a preset button (e.g. "Premium") — preview updates + command appears in terminal
- [ ] Click "Background" category — options expand
- [ ] Click "Aurora Glow" — preview updates + `/set bg aurora` in terminal
- [ ] Click another category — previous collapses, new one expands
- [ ] Click "/save" button — configuration saves
- [ ] Click "/reset" button — configuration resets
- [ ] Click the chevron (collapse) — Quick Controls panel closes

### 8. Share Page

- [ ] Visit `/u/juan294` — see badge preview + impact breakdown
- [ ] Dark theme, consistent with rest of app
- [ ] Hover over badge elements (heatmap, radar, score, tier) — tooltips appear
- [ ] Hover over dimension cards in breakdown — tooltips explain each dimension
- [ ] Hover over stat cards — tooltips explain each metric

### 9. Global Command Bar

- [ ] Visit `/u/juan294` (or `/about`, `/terms`, `/privacy`)
- [ ] See terminal bar at the bottom of the page
- [ ] Type `/help` — see available commands
- [ ] Type `/home` — navigates to landing page
- [ ] Type `/badge torvalds` — navigates to `/u/torvalds`
- [ ] Type `/about` — navigates to about page
- [ ] (Admin only) Type `/admin` — navigates to admin dashboard
- [ ] (Admin only) Type `/refresh` — refreshes dashboard data

### 10. Admin Dashboard

- [ ] Visit `/admin` (must be logged in as an admin handle)
- [ ] See user table with sortable columns
- [ ] Click the Refresh button — user data reloads
- [ ] Type `/sort score` in terminal — table sorts by adjusted score
- [ ] Type `/sort commits` — table sorts by commit count
- [ ] Type `/sort` (no args) — see available sort fields

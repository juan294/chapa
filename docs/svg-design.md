# Chapa Badge SVG Design (React-to-SVG)

## Output formats
- Default: 1200×630 (wide)
- Theme: Midnight Mint
- Rendering method: JSX <svg> template rendered server-side to string.

## Layout goals
- Premium dark card with mint accents
- Strong hierarchy: title > heatmap > tier > key stats
- Readable at small size
- Subtle animation only

## Components
1) Background frame
- Rounded rect with subtle inner shadow / gradient
- Border stroke (low opacity mint/white)

2) Title block (top-left)
- "CHAPA" + subtitle "Developer Impact Badge" (or similar)
- Display handle/name

3) Heatmap block (left)
- 13 weeks x 7 days grid (91 cells)
- Cell size ~ 14–16px with 3–4px gap (tune for balance)
- 5 intensity colors from theme
- Animation: fade-in by week group

4) Stats block (right)
- PRs merged
- Reviews
- Commits
- (Optional) Lines changed
- Use mono font for numbers

5) Impact block (right, prominent)
- "IMPACT: HIGH/ELITE"
- "Score: NN"
- "Conf: NN" small
- Small confidence icon (optional)

6) Footer
- "Powered by GitHub" + GitHub mark (optional, behind flag)
- Must be swappable/removable via flag.

## GitHub branding swap
- `includeGithubBranding: boolean`
- Branding isolated in a `GithubBranding` component or file.
- If disabled, layout should still look balanced (no big empty gap).

## Theme tokens (Midnight Mint)
- bg: #0B0F14
- card: #0F1720
- textPrimary: #E6EDF3
- textSecondary: #9AA4B2
- mint: #39FF88 (or close to your mock)
- stroke: rgba(230,237,243,0.12)

Heatmap palette (0..4):
- 0: rgba(230,237,243,0.06)
- 1: rgba(57,255,136,0.20)
- 2: rgba(57,255,136,0.38)
- 3: rgba(57,255,136,0.58)
- 4: rgba(57,255,136,0.85)

## Typography
- Primary: Inter
- Mono: JetBrains Mono (numbers)
- Sizes (suggested):
  - Title: 42–48
  - Subtitle: 16–18
  - Stat numbers: 40–52
  - Labels: 14–16
  - Footer: 12–14

## Animation guidelines
- Minimal, not distracting
- Heatmap weeks fade-in 50–80ms stagger
- Impact label has subtle glow pulse (very low amplitude)
- Avoid large movements

## Accessibility
- Ensure contrast is high enough for legibility
- Avoid tiny text below 12px
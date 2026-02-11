# Badge Visual Research: From Okay to Jewel-Tier

> Refs #38 | Generated 2026-02-10

## Executive Summary

The badge is Chapa's core product — if it doesn't make developers say "I want that on my profile", nothing else matters. This document synthesizes research across SVG animation, rich media, CSS effects, and design inspiration to propose a transformation roadmap.

**Key insight**: The badge lives in three different contexts with wildly different capabilities. The strategy must be **multi-format**: a polished animated SVG for READMEs, and a rich interactive experience on the share page.

| Context | What Works | What Doesn't |
|---------|-----------|--------------|
| GitHub README (`<img>`) | CSS `@keyframes` in SVG, SMIL `<animate>` | JS, `<foreignObject>`, hover, external CSS |
| Personal site (`<iframe>` / `<object>`) | Full HTML/CSS/JS, interactivity | Limited by iframe sandbox |
| Share page (`/u/:handle`) | Everything — full browser APIs | N/A (we control it) |

---

## Current State

The badge is a **1200x630 server-rendered SVG** with:
- Two-column layout: heatmap (left) + impact score (right)
- Warm amber theme (#E2A84B accent on #12100D background)
- Two animations: SMIL heatmap fade-in (staggered by week) + score opacity pulse
- Stats row: commits, PRs merged, reviews
- GitHub branding footer

**What's working**: Clean layout, readable at small sizes, warm premium palette.
**What's missing**: Visual excitement, jewel-like quality, "I want to show this off" factor.

---

## The Multi-Format Strategy

### Format 1: Animated SVG Badge (for README embeds)

**Constraints**: No JS, no `<foreignObject>`, no external resources, no hover states. CSS `@keyframes` and SMIL `<animate>` both work in GitHub READMEs (confirmed via github-readme-stats, capsule-render, readme-typing-svg).

**What we can do within these constraints**:
- Animated gradient fills via SMIL `<animate>` on gradient stops
- Staggered cell reveals (heatmap, stats)
- Pulsing glows via animated `opacity` + `filter`
- Metallic/gold text via SVG `<linearGradient>` with shimmer animation
- Stroke-dashoffset line-drawing reveals
- `@keyframes` animations in `<style>` blocks

**GitHub-specific gotcha**: `dominant-baseline` attribute is stripped by GitHub's sanitizer. Use `dy` attribute for vertical text alignment instead.

### Format 2: Rich Interactive Badge (for personal sites)

**Delivery**: `<iframe>` or `<object>` pointing to an HTML endpoint, or a Web Component (`<chapa-badge handle="...">`).

**What this unlocks**: Full CSS (glassmorphism, 3D transforms, blend modes), JavaScript (mouse tracking, counters, particles), hover/click interactions.

### Format 3: Share Page Experience (`/u/:handle`)

**No constraints** — full React app with all browser APIs. This is where we go all-out.

---

## Top Recommendations (Ranked by Impact x Feasibility)

### 1. Metallic Gold Tier Labels + Score Shimmer (SVG Badge)
**Impact**: HIGH | **Effort**: LOW | **Context**: SVG badge

The impact score and tier label are the badge's centerpiece. Making them feel like actual gold/metal transforms the entire perception.

**Technique**: SVG `<linearGradient>` with animated gradient stops:
```svg
<defs>
  <linearGradient id="gold-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#C28A2E"/>
    <stop offset="45%" stop-color="#F6E27A">
      <animate attributeName="offset" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite"/>
    </stop>
    <stop offset="50%" stop-color="#F6F2C0">
      <animate attributeName="offset" values="0.3;0.55;0.3" dur="3s" repeatCount="indefinite"/>
    </stop>
    <stop offset="55%" stop-color="#F6E27A">
      <animate attributeName="offset" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite"/>
    </stop>
    <stop offset="100%" stop-color="#C28A2E"/>
  </linearGradient>
</defs>
<text fill="url(#gold-shimmer)" font-size="96" font-weight="800">87</text>
```

This creates a living, breathing metallic shine on the score number — visible even at small sizes.

### 2. Animated Gradient Border (SVG Badge + Share Page)
**Impact**: HIGH | **Effort**: LOW-MEDIUM | **Context**: Both

A slowly rotating amber gradient border makes the badge feel like a premium card with an active edge.

**SVG approach**: Animate `<linearGradient>` `gradientTransform` rotation:
```svg
<linearGradient id="border-gradient" gradientUnits="userSpaceOnUse">
  <stop offset="0%" stop-color="rgba(226,168,75,0.5)"/>
  <stop offset="50%" stop-color="rgba(226,168,75,0.1)"/>
  <stop offset="100%" stop-color="rgba(226,168,75,0.5)"/>
  <animateTransform attributeName="gradientTransform" type="rotate"
    from="0 600 315" to="360 600 315" dur="6s" repeatCount="indefinite"/>
</linearGradient>
```

**Share page approach**: CSS `@property` for `--gradient-angle` with conic-gradient, or the `background-size: 200%` fallback for broader support.

### 3. Enhanced Heatmap Animation (SVG Badge)
**Impact**: MEDIUM-HIGH | **Effort**: LOW | **Context**: SVG badge

Current: cells fade in by week. Proposed: cells scale-in individually with a diagonal wave, creating a satisfying "building up" effect.

**Technique**: Combine opacity + transform animations with cell-level delays:
```svg
<rect class="cell" opacity="0" transform="scale(0.5)">
  <animate attributeName="opacity" from="0" to="1" dur="0.4s"
    begin="0.8s" fill="freeze"/>
  <animateTransform attributeName="transform" type="scale"
    from="0.5" to="1" dur="0.4s" begin="0.8s" fill="freeze"/>
</rect>
```

Delay formula: `begin = (col * 40 + row * 60)ms` for a diagonal wave.

### 4. 3D Tilt Effect on Share Page Badge Card
**Impact**: HIGH | **Effort**: MEDIUM | **Context**: Share page

Mouse-tracking 3D perspective tilt on the badge preview — the "Pokemon card" interaction that makes people play with it.

**Libraries**:
- `react-parallax-tilt` (7KB, zero-config) — recommended
- Vanilla JS (custom implementation, no dependency)

**Implementation**: Wrap the badge `<img>` in a tilt container with `perspective(1000px)`. Add depth layers: heatmap at `translateZ(-20px)`, score at `translateZ(30px)`, border glow at `translateZ(-40px)`.

### 5. Holographic/Iridescent Hover Effect (Share Page)
**Impact**: HIGH | **Effort**: MEDIUM | **Context**: Share page

On hover, a rainbow-shifted gradient sweeps across the badge card using `mix-blend-mode: color-dodge`. This creates the "holographic trading card" effect that's instantly recognizable and shareable.

**Reference**: [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) — the gold standard.

**Chapa adaptation**: Use warm amber spectrum instead of full rainbow:
```css
.badge-card::before {
  background: linear-gradient(
    115deg,
    transparent 20%,
    rgba(226, 168, 75, 0.4) 36%,
    rgba(240, 201, 125, 0.4) 46%,
    rgba(194, 138, 46, 0.4) 56%,
    transparent 80%
  );
  mix-blend-mode: color-dodge;
  animation: holo-shift 4s ease infinite;
}
```

### 6. Animated Number Counters (Share Page)
**Impact**: MEDIUM | **Effort**: LOW | **Context**: Share page

Stats count up from 0 to their final value when scrolled into view. The impact score does a dramatic count-up as the hero element.

**Modern CSS**: `@property --num` with `counter-reset` (Chrome/Edge).
**Fallback**: `requestAnimationFrame` JS counter for Firefox/Safari.
**Trigger**: IntersectionObserver to start animation on scroll-in.

### 7. Confetti Burst for High Scores (Share Page)
**Impact**: MEDIUM | **Effort**: LOW | **Context**: Share page

When score is 90+ (Elite tier), trigger an amber confetti burst using `canvas-confetti` (3KB). Colors match the warm amber palette: `['#E2A84B', '#F0C97D', '#C28A2E']`.

### 8. Dark Glassmorphism Containers (Share Page)
**Impact**: MEDIUM | **Effort**: LOW | **Context**: Share page

Replace flat card backgrounds with frosted glass panels:
```css
.glass-card {
  background: rgba(26, 22, 16, 0.6);
  backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid rgba(226, 168, 75, 0.12);
}
```

### 9. Web Component Embed (`<chapa-badge>`)
**Impact**: HIGH | **Effort**: HIGH | **Context**: Personal sites, blogs

A custom element that loads the full interactive badge:
```html
<script src="https://chapa.thecreativetoken.com/embed.js"></script>
<chapa-badge handle="juan294"></chapa-badge>
```

This unlocks all interactive effects (tilt, hover, animations) for personal sites while keeping the embed experience simple.

### 10. Tier-Specific Visual Treatment (SVG Badge)
**Impact**: MEDIUM-HIGH | **Effort**: MEDIUM | **Context**: SVG badge

Different tiers get progressively more premium visual treatment:
- **Emerging**: Clean, minimal — solid colors, subtle fade-in
- **Solid**: Metallic silver text gradient on score
- **High**: Gold text gradient + animated border glow
- **Elite**: Full gold shimmer + animated border + enhanced glow + sparkle dots

This creates aspiration — people see Elite badges and want to earn one.

---

## Feasibility Matrix

| Technique | SVG `<img>` | `<iframe>` | Share Page | File Size Impact | Browser Support |
|-----------|:-----------:|:----------:|:----------:|:---------------:|:--------------:|
| CSS `@keyframes` in SVG | Yes | Yes | Yes | ~200B/anim | Universal |
| SMIL `<animate>` | Yes | Yes | Yes | ~100B/anim | Universal |
| SVG gradient animation | Yes | Yes | Yes | ~300B | Universal |
| `backdrop-filter` | No | Yes | Yes | 0 (CSS) | 95%+ |
| `mix-blend-mode` | No | Yes | Yes | 0 (CSS) | 97%+ |
| CSS `@property` | No | Yes | Yes | 0 (CSS) | Chrome/Edge only |
| 3D transforms | No | Yes | Yes | 0 (CSS+JS) | Universal |
| Mouse tracking | No | Yes | Yes | ~1KB JS | Universal |
| canvas-confetti | No | Yes | Yes | ~3KB | Universal |
| Web Component | No | Yes | N/A | ~5-10KB | 97%+ |
| Lottie animations | No | Yes | Yes | Varies | Universal |
| Three.js / R3F | No | Yes | Yes | ~150KB | 95%+ |

---

## Inspiration References

### Developer Badge Ecosystem
- **github-readme-stats** (70K+ stars) — CSS animations in SVG, 60+ themes, auto-updating
- **capsule-render** — parameterized animations (`fadeIn`, `scaleIn`, `blink`)
- **readme-typing-svg** — SMIL path morphing for typewriter effect
- **fitbit-readme-stats** — animated heart that beats in sync with live heart rate

### Shareable Card Precedents
- **Spotify Wrapped** — pre-generated shareable cards, story progression, tier comparison
- **GitHub Skyline** — 3D contribution graph (STL export for 3D printing)
- **Vercel Event Badge** — React Three Fiber interactive 3D badge (5.2KB overhead)

### Premium Visual References
- **Pokemon Cards CSS** — holographic foil effect (blend modes + gradients)
- **Apex Legends ranks** — tier emblems with progressive visual complexity
- **Enamel pin aesthetic** — clean lines, solid fills, collectible feel
- **Dark glassmorphism (2026 trend)** — frosted amber glass on dark backgrounds

---

## Proposed Implementation Phases

### Phase 1: SVG Badge Glow-Up (1-2 days)
Make the embeddable badge itself more visually striking:
1. Gold metallic shimmer on impact score number
2. Animated gradient border (rotating amber)
3. Enhanced heatmap animation (diagonal wave reveal with scale)
4. Tier-specific visual treatments (progressive premium effects)
5. Subtle ambient glow pulse on the badge background

### Phase 2: Share Page Experience (2-3 days)
Transform the share page into a showcase:
1. 3D tilt effect on badge card (react-parallax-tilt)
2. Holographic hover overlay (amber spectrum blend)
3. Dark glassmorphism containers
4. Animated number counters (stats + score)
5. Confetti burst for Elite tier
6. Enhanced staggered animations

### Phase 3: Multi-Format Embeds (3-5 days)
Expand how the badge can be shared:
1. HTML embed endpoint (rich interactive version)
2. Web Component (`<chapa-badge>`)
3. Dynamic OG image (Next.js ImageResponse for social sharing)
4. Multiple embed snippets on share page (Markdown, HTML, iframe, Web Component)

---

## Technical Constraints to Remember

1. **GitHub strips `<foreignObject>`** — cannot embed HTML inside SVG for README context
2. **GitHub strips `dominant-baseline`** — use `dy` attribute for text vertical alignment
3. **No JS in `<img>` SVGs** — all animations must be CSS or SMIL
4. **No external resources in `<img>` SVGs** — fonts, images must be embedded or use system fonts
5. **SVG file size matters** — target under 50KB for fast loading in READMEs
6. **`prefers-reduced-motion`** — must be respected on share page; SVG animations should be subtle enough to not cause issues
7. **`@property` is Chrome/Edge only** — always provide fallback for animated counters and gradient angles

---

## Sources

### SVG Animation
- [CSS-Tricks: Animating SVG with CSS](https://css-tricks.com/animating-svg-css/)
- [CSS-Tricks: Guide to SVG Animations (SMIL)](https://css-tricks.com/guide-svg-animations-smil/)
- [MDN: SVG animation with SMIL](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_animation_with_SMIL)
- [Smashing Magazine: Styling and Animating SVGs with CSS](https://www.smashingmagazine.com/2014/11/styling-and-animating-svgs-with-css/)
- [Can I use: SVG SMIL animation](https://caniuse.com/svg-smil)
- [Animate SVGs for GitHub READMEs](https://blog.eamonncottrell.com/animate-svgs-for-github-readmes)

### GitHub README Compatibility
- [GitHub Community: Interactive SVG animations in Markdown](https://github.com/orgs/community/discussions/151372)
- [GitHub Markup Issue #1160: SVG sanitizer affecting layout](https://github.com/github/markup/issues/1160)
- [CSS-Tricks: Custom Styles in GitHub READMEs](https://css-tricks.com/custom-styles-in-github-readmes/)

### Real-World Badge Projects
- [github-readme-stats](https://github.com/anuraghazra/github-readme-stats) — 70K+ stars, CSS animations in SVG
- [capsule-render](https://github.com/kyechan99/capsule-render) — parameterized SVG animations
- [readme-typing-svg](https://github.com/DenverCoder1/readme-typing-svg) — SMIL path animation
- [fitbit-readme-stats](https://github.com/f0nkey/fitbit-readme-stats) — animated heartbeat SVG

### CSS Visual Effects
- [CSS-Tricks: Holographic Trading Card Effect](https://css-tricks.com/holographic-trading-card-effect/)
- [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) — holographic foil CSS
- [CSS-Tricks: Animating a CSS Gradient Border](https://css-tricks.com/animating-a-css-gradient-border/)
- [CSS-Tricks: Animating Number Counters](https://css-tricks.com/animating-number-counters/)
- [CSS-Tricks: Staggered Animation Approaches](https://css-tricks.com/different-approaches-for-creating-a-staggered-animation/)
- [Inverness Design Studio: Glassmorphism in 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)

### Interactive Effects
- [GSAP (GreenSock)](https://greensock.com/gsap) — animation library
- [Motion (Framer Motion)](https://motion.dev) — React animation
- [react-parallax-tilt](https://github.com/mkosir/react-parallax-tilt) — 3D tilt effect
- [canvas-confetti](https://github.com/catdad/canvas-confetti) — confetti particles
- [tsParticles](https://particles.js.org/) — particle system

### Rich Media & Sharing
- [Vercel Blog: Interactive 3D Event Badge with React Three Fiber](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber)
- [Next.js: Metadata and OG Images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Spotify Wrapped 2025](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/)
- [GitHub Skyline](https://skyline.github.com/)

### Design Inspiration
- [Dribbble: Profile Card Designs](https://dribbble.com/tags/profile-cards)
- [Apex Legends Ranks](https://pley.gg/apex-legends/apex-legends-ranks/)
- [Enamel Pin Design Trends](https://www.enamelbadges.com/pin-badge-design-trends-for-2024/)

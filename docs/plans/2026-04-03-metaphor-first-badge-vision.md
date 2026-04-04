# Metaphor-First Badge Vision

> Product vision for evolving Chapa's badge from a GitHub-derived heatmap to a metaphor-driven identity artifact.

## Status

| Field | Value |
|-------|-------|
| Created | 2026-04-03 |
| Phase | Discovery complete, pre-prototyping |
| Source | Q&A session (Juan + Claude), informed by [metaphor-first visualization research](../research/2026-04-03-metaphor-first-visualization-research.md) |
| v1 prototype archetype | Builder (Juan's own profile) |

## One-liner

Replace the GitHub-style heatmap with an archetype-specific, two-layer identity artifact that turns developer metrics into a signature object — honest, ownable, and worth sharing.

---

## 1. What Chapa Is Becoming

Chapa's badge is not a chart. It is a **living, data-honest, archetype-specific identity artifact** — a generated object that reflects who a developer is as an engineer.

The badge should feel like something a developer built through sustained work, not something a dashboard rendered from a spreadsheet. When someone sees it, the reaction should land between **"that's me"** (identity recognition) and **"I want that on my profile"** (display value).

The visual core of Chapa competes less with dashboards and more with:
- Personal identity graphics
- Generated signatures
- "Wrapped"-style summary objects
- Social-share artifacts

The compound moat is: **unique scoring intelligence × unique visual identity**. Neither is disposable.

---

## 2. Strategic Decisions

These decisions were made during the 2026-04-03 discovery session and are binding for this vision.

| Decision | Answer | Implication |
|----------|--------|-------------|
| Metaphor family | Archetype-specific (start with one, branch later) | Each archetype gets its own visual language over time |
| Departure level | Clean break from GitHub heatmap | No residual GitHub contribution grid DNA |
| Temporal model | Two layers: surface (365-day rolling) + depth (lifetime) | The metaphor tells two stories simultaneously |
| Tenure | Visually rewarded | Longer-tenured users get richer, more complex artifacts |
| Decay behavior | Honest reflection | Badge dims when inactive. Credibility over vanity |
| Complexity appetite | Worth the investment | Multi-quarter design system, not a sprint |
| Cold start | Data-driven, not tenure-driven | A strong dev's first badge IS strong from GitHub history |
| Share page | Animated timeline + history comparison (v1) | Badge is the hook; share page is the full experience |
| Data horizon | Store indefinitely in Supabase | Build a lifetime engineering biography |
| Tech split | Static SVG badge + rich animated share page | Two rendering contexts, same visual language |
| Moat | Compound (scoring × visual) | Both must be distinctive |
| Brand | "Forged from purpose" is an anchor, not a cage | Influences tone (weight, intensity, pressure) without constraining metaphor |
| Legibility | Intriguing, then learnable | Badge earns curiosity; share page delivers understanding |
| v1 prototype | Builder archetype, Juan's own data | Dogfood with real data from the product creator |

---

## 3. Badge Architecture

### v1 Scope

The current badge has two visual zones:

```
┌─────────────────────────────────────────────────────────┐
│                    │                                     │
│    LEFT PANEL      │          RIGHT PANEL                │
│   (heatmap grid)   │   (radar chart + stats + score)     │
│                    │                                     │
└─────────────────────────────────────────────────────────┘
```

**v1 changes only the left panel.** The heatmap is replaced with the metaphor visualization. The right panel (radar chart, composite score, archetype label, stats) remains unchanged.

This is a deliberate scope constraint:
- Limits blast radius of the change
- Keeps the analytical anchor (radar) while introducing the metaphor
- Allows independent evaluation of whether the metaphor works

### Future (v2+)

If the metaphor proves strong enough to carry more of the badge's information load, a future version could:
- Merge radar data INTO the metaphor (dimensions encoded as visual properties)
- Move the composite score into or alongside the metaphor
- Use the full badge canvas (1200×630) for the artifact
- Relocate the analytical breakdown (radar, dimension cards) entirely to the share page

This is NOT committed. The v1 result will inform whether it makes sense.

---

## 4. Temporal Model: Two Layers

The most significant insight from the discovery session — and something the original research document did not address — is that the metaphor needs a **temporal architecture** beyond a single rolling window.

### The Problem

A fixed-window metaphor (90 days or 365 days) has three failure modes:

1. **Ceiling**: A peak performer can "complete" the artifact within the window. There's nowhere to grow.
2. **Decay**: Scores go up and down (by design). On a *public* badge, visible degradation during inactivity becomes punitive — the Tamagotchi trap.
3. **Engagement horizon**: If the artifact can be "finished" in one window, there's no reason to keep coming back.

### The Solution: Surface + Depth

The metaphor has two temporal layers, sourced from different data:

#### Surface Layer — 365-Day Rolling Scores

- **Source**: Current Impact v6 scoring (unchanged)
- **Behavior**: Rises and falls honestly based on recent activity
- **Visual role**: The *active, current-state* aspect of the metaphor — height, brightness, energy, activity
- **Decay**: Yes. When activity drops, the surface reflects it. This is the honest signal.

#### Depth Layer — Lifetime MetricsSnapshot History

- **Source**: `metrics_snapshots` table in Supabase (permanent, no TTL)
- **Behavior**: Only grows richer over time. Never degrades.
- **Visual role**: The *accumulated, historical* aspect — foundation depth, structural complexity, layered strata, infrastructure richness
- **Decay**: No. History is permanent. A developer who was active for 2 years has deep structure even during a 3-month break.

#### How They Interact

| Developer state | Surface | Depth | Badge feel |
|----------------|---------|-------|------------|
| New + active (90 days) | Bright, tall, energetic | Thin, simple | Impressive but young |
| Veteran + active (2 years) | Bright, tall, energetic | Rich, complex, layered | The fullest artifact |
| Veteran + dormant (break after 2 years) | Dim, quiet, shorter | Rich, complex, layered | Deep history, resting surface |
| New + inactive (barely coded) | Low, sparse | Almost nothing | Emerging |

The veteran on sabbatical doesn't have a degraded badge. They have a **deep, sleeping** badge. When they return, the surface lights up again on top of that rich history. That's a return story, not a punishment story.

### Tenure Reward

Time on Chapa is visually rewarded independently of scoring. A 2-year user's artifact looks fundamentally richer and more complex than a 2-week user's — even if their current scores are identical. This:
- Creates a natural progression system
- Rewards early adopters
- Gives users a reason to keep their badge active over time
- Prevents the ceiling problem (your artifact always has room to grow in depth)

### Cold Start Clarification

Cold start is a function of **the developer's GitHub history**, not their Chapa tenure. A senior developer who signs up today already has 365 days of GitHub data. Their first badge should be strong — because their data is strong.

The "seed" or "earn it" experience only applies to developers who genuinely have limited GitHub activity. The metaphor doesn't need a special "new user" state. It faithfully renders whatever the data says.

### Honest Decay

This is a deliberate design choice: **the badge can look less impressive during low-activity periods, even on a public profile.**

The rationale: a badge that never looks bad isn't credible. The honesty IS the value proposition. If it always looks good, it's decoration, not data. The depth layer (which never degrades) prevents this from being purely punitive — the history survives, only the surface quiets down.

---

## 5. Metaphor Strategy

### v1: One Metaphor, Proven With Real Data

Ship with a **single base metaphor** — the Builder archetype's **Architectural Strip** — tested against Juan's actual Chapa profile data. This is the first metaphor that gets built, validated, and shipped.

Why Builder first:
- It's Juan's archetype, enabling direct first-person evaluation
- "Architecture" is the most legible metaphor in the research (highest glance-legibility score)
- The city/architecture metaphor has the strongest research lineage (CodeCity, GitCity, 2024 systematic mapping study)
- It directly communicates "you built this" — the most intuitive story for a developer badge

Why Architectural Strip (not full 3D city):
- 2D procedural strip fits the badge's rectangular left panel
- Avoids derivative association with GitCity/CodeCity
- SVG-native (path primitives, no WebGL)
- Can be flattened to silhouette at small sizes

### v2: Archetype Branching

After the base metaphor is proven, each archetype gets its own visual family:

| Archetype | Metaphor direction | Key visual properties |
|-----------|--------------------|-----------------------|
| **Builder** | Architectural strip / skyline | Structures, facades, urban density |
| **Quality Champion** | Forged alloy / defense lattice | Temper lines, grain density, structural integrity |
| **Marathoner** | Geological terrain / strata | Contour lines, elevation, erosion patterns, deep layers |
| **Polymath** | Branching circuit / hybrid network | Trace diversity, branching complexity, node variety |
| **Artificer** | Energized circuit board | Illuminated traces, node glow, signal routing |
| **Balanced** | Harmonic interference / spectral field | Even wave distribution, balanced signal bands |
| **Emerging** | Seed/embryo/spark | Minimal but promising — clear starting state |

These are directional, not final. Each would go through its own prototype–validate cycle.

### v2 Branching Support in v1

The v1 Builder metaphor must be designed so the system can branch later without a full rewrite. Concretely, this means:

1. **The rendering pipeline is parameterized.** The SVG generation function accepts a config object that controls visual style, not hardcoded Builder aesthetics. When we add Guardian later, we swap the config, not the renderer.

2. **The data mapping is abstracted.** A `MetaphorMapping` type defines which dimension maps to which visual property. Builder's mapping (delivery → height, quality → detail, etc.) is one instance. Guardian's mapping would be a different instance using the same interface.

3. **The temporal model is universal.** Surface + depth applies to all archetypes. The archetype only changes how those layers are *rendered*, not how they're *sourced*.

4. **CSS variables and archetype theming.** Chapa already has `--color-archetype-builder`, `--color-archetype-guardian`, etc. The metaphor should use these tokens, not hardcoded colors.

### Brand Alignment

"Forged from purpose. Driven by curiosity." — this tagline anchors the visual language without constraining it.

The "forging" concept should influence the metaphor's **tone**: weight, intensity, pressure, heat, craft. An architectural strip can feel *forged* if the structures look load-bearing, tempered, and deliberately constructed — rather than toy-like or decorative.

The brand anchor means:
- The metaphor should feel **heavy** and **consequential**, not light or whimsical
- Materials should feel **engineered**: steel, glass, concrete, circuitry — not organic or natural
- The process should feel **intentional**: built, forged, constructed — not grown or random
- Dark theme badge rendering reinforces this industrial/engineering tone

---

## 6. Data Mapping Spec: Builder (v1 Prototype)

This is the proposed mapping of Chapa's scoring data to visual properties in the Builder Architectural Strip metaphor. It is a starting point for prototyping, not a final spec.

### Surface Properties (365-Day Rolling Scores)

These visual properties reflect the current state and can rise or fall.

| Visual property | Data source | Mapping logic | Rationale |
|----------------|-------------|---------------|-----------|
| Structure height | Delivery dimension (0–100) | Linear scale. Score 0 = ground level, score 100 = max height | Delivery = shipping. Tall buildings = lots shipped. Direct metaphor. |
| Structure spacing & regularity | Consistency dimension (0–100) | High consistency = evenly spaced, uniform rhythm. Low = clustered with gaps | Consistency = cadence. Dense urban fabric vs. scattered outposts. |
| Structure detail & refinement | Quality dimension (0–100) | High quality = clean lines, articulated facades, glass. Low = rough, minimal | Quality = craftsmanship. Polished towers vs. raw concrete. |
| Structure type diversity | Breadth dimension (0–100) | High breadth = varied building shapes, widths, roof types. Low = monoculture | Breadth = range. Diverse district vs. identical blocks. |
| Luminous details (lit windows, energy traces) | Craft dimension (0–100, optional) | Present = glowing accents. Absent = no illumination layer | Craft = AI mastery. "Smart building" energy signatures. |
| Skyline atmosphere / ambient energy | Composite score (0–100) | Higher composite = more vibrant sky gradient above the skyline | The aggregate impression. Atmosphere wraps the individual structures. |
| Recency gradient | Recency weighting (0.98x–1.06x) | Right side (recent weeks) slightly more vivid/saturated than left side | Natural temporal fading. Most recent work is most vivid. |

### Depth Properties (Lifetime MetricsSnapshot History)

These visual properties reflect accumulated history and only grow richer.

| Visual property | Data source | Mapping logic | Rationale |
|----------------|-------------|---------------|-----------|
| Foundation depth (below ground line) | Snapshot count / tenure months | More months = more visible underground layers | History becomes literal foundation. |
| Foundation strata color bands | Historical score ranges per period | Color bands showing past score levels (each era gets a visible layer) | Geological ages — you can see the eras of your engineering life. |
| Infrastructure complexity (grid lines, underground traces) | Historical dimension variance | More varied history = more complex subsurface patterns | Rich history produces rich infrastructure. |
| Ground line richness | Archetype transitions | If archetype changed over time, ground line shows transition markers | Career evolution visible in the foundation. |

### Temporal Properties (X-Axis)

| Visual property | Data source | Mapping logic | Rationale |
|----------------|-------------|---------------|-----------|
| Horizontal position | Time (weeks, left-to-right) | Left = oldest visible period, right = most recent | Standard temporal reading direction. |
| Sparse zones / gaps | Inactive weeks | Fewer, shorter, or absent structures | Honest reflection of inactivity. No filler. |
| Construction detail density | Weekly contribution volume | More active weeks have more facade detail | Activity density maps naturally to visual density. |

### Badge-Scale Compression Rules

At embedded sizes (300–600px wide), the left panel may be only 150–250px. At this scale:

- Individual buildings merge into a **silhouette/skyline** — the overall shape communicates the story
- Foundation strata reduce to a simple gradient band
- Luminous details (Craft) reduce to a subtle glow rather than individual lit windows
- The key signal that must survive: **the skyline's shape over time** (peaks, valleys, rhythm)

---

## 7. Share Page Evolution

The share page (`/u/:handle`) is the richer canvas where the metaphor can breathe.

### v1 Features

#### Animated Timeline — "Watch It Form"

The default experience. The user can scrub through their history and watch the architectural strip build up over time — structures rising week by week, foundations deepening, atmosphere changing.

This is the "Wrapped" moment: an emotional, shareable playback of your engineering history.

Implementation approach:
- Timeline scrubber below the badge area
- SVG animation driven by interpolating between MetricsSnapshot records
- Playback speed: ~3–5 seconds for a full 12-month sweep
- Pause/scrub to explore specific periods
- Screenshot/share button at any point in the timeline

#### History Comparison

Side-by-side or overlay view: "Your badge 3 months ago vs. today" or "Your badge 1 year ago vs. today."

This makes growth (or change) tangible. A developer who improved their Quality dimension from 40 to 75 would see their structures transform from rough concrete to articulated glass facades.

Implementation approach:
- Date picker for comparison points
- Side-by-side badge rendering at both points in time
- Delta indicators for score changes between the two points
- Highlight which visual properties changed most

### v1 Modes

The share page offers two modes (toggle):
1. **Emotional mode** (default): "Watch it form" animation. Optimized for sharing, screenshots, social media.
2. **Analytical mode**: Traditional dimension breakdowns, score history charts, metric details. Rendered in the metaphor's visual language (not generic line charts), but focused on data inspection.

### Future Features (Documented, Not Committed)

These are ideas to revisit after v1 ships:

#### Interactive Deep Dive
Click into dimension breakdowns, see what drives each score, explore the strata. The analytical layer that the badge compresses.

#### Social Proof Layer
Archetype community stats, percentile context, how your dimensions compare to developers in your archetype. The social/competitive layer.

#### Archetype Explorer
Browse what other archetypes' visual languages look like. "If you were a Marathoner, your badge would look like this." Drives curiosity and engagement with the system.

---

## 8. Data Layer Requirements

### Supabase (Persistent Storage — Long-Term Biography)

Supabase is the permanent record. No TTL on historical data.

**Current state (already exists):**
- `metrics_snapshots` table: composite score, dimension scores, archetype, tier. One row per user per day (UNIQUE constraint on handle+date).

**Required additions for metaphor depth layer:**
- Ensure all dimension-level scores are preserved in each snapshot (delivery, quality, consistency, breadth, craft)
- Track archetype per snapshot (to detect archetype transitions over time)
- Consider adding: weekly contribution volume, active days count, or other shape-describing metrics that inform the visual rendering

**Data retention policy:**
- Indefinite. Every snapshot is permanent.
- Goal: build a decade of engineering biography if the data accumulates
- Even if scoring algorithms change, raw snapshots preserve the historical record
- Future visualizations and share-page features will consume this historical data

**Why this matters:**
Supabase is evolving from "store the latest state" to "store the complete engineering biography." MetricsSnapshot is the foundation for the depth layer, the animated timeline, the history comparison, and any future long-term visualization.

### Redis / Upstash (Cache Layer — Hot-Path Performance)

No changes to the cache layer's role. Redis continues to:
- Cache computed stats + impact per user/day (TTL 24h)
- Cache SVG output per user/day + theme (TTL 24h)
- Provide rate-limiting
- Fail-open when unavailable

The metaphor visualization adds no new cache requirements beyond what already exists. The SVG output cache will contain the new metaphor-rendered badge instead of the heatmap-rendered badge.

---

## 9. Design Principles

### 1. Never lie
The badge always reflects reality. No inflation during low periods. No artificial richness for sparse data. If you haven't done anything, the badge shows it. Credibility is the product's foundation.

### 2. Worth the investment
This is a multi-quarter design system. The depth of the metaphor system IS the moat. Rushing a shallow version is worse than taking the time to build the real thing.

### 3. Intriguing, then learnable
The badge doesn't need to be self-explanatory. It needs to be visually striking enough that someone asks "what is that?" and clicks through to the share page. The badge earns curiosity; the share page delivers understanding.

### 4. Compound moat
Unique scoring intelligence (Impact v6, solo-dev awareness, AI-era Craft dimension) rendered through a unique visual language (archetype-specific metaphor artifacts). Neither alone is defensible. Together, they create something hard to replicate.

### 5. Forged, not generated
The visual tone should feel deliberate, heavy, engineered. Not light, playful, or random. The badge looks like something that was *built through work*, not something an algorithm produced.

### 6. Data shapes the artifact
Two developers' badges look different because their data is different, not because of random variation. The metaphor is deterministic: same data → same artifact. This makes it feel personal and earned.

---

## 10. Prototyping Plan

### Phase 1: Hero SVG Mockup

**Goal**: A single, hand-crafted SVG showing what the Builder Architectural Strip could look like in the badge's left panel, using Juan's actual scoring data.

**Deliverable**: One static SVG at 1200×630, with the left panel showing the architectural strip and the right panel showing the existing radar + stats.

**Key questions to answer**:
- Does the architectural strip feel "built" or "charted"?
- Does it feel like a Chapa product, not a GitCity derivative?
- Does the two-panel layout (metaphor left, radar right) feel coherent?

### Phase 2: Data Mapping Validation

**Goal**: Test the proposed data mapping (Section 6) against real profile data from multiple users with different scoring profiles.

**Method**:
- Render the metaphor for 5–10 users with diverse scores (high delivery/low quality, consistent/bursty, etc.)
- Verify that visually distinct profiles produce visually distinct badges
- Verify that the dimension → visual property mapping is intuitive

**Key questions to answer**:
- Can you tell two different developers apart from their architectural strips?
- Does a high-Quality developer's badge look noticeably "cleaner" than a low-Quality one?
- Does the Consistency dimension read as rhythm, or is it lost?

### Phase 3: Small-Size Stress Test

**Goal**: Verify the metaphor survives compression to embedded sizes.

**What this means**: The badge embeds in GitHub READMEs, LinkedIn profiles, personal sites, and portfolio pages. At these sizes, it may render at 300–600px total width, which means the left panel is only 150–250px wide. The metaphor must still communicate its core signal at this size.

**Test criteria**:
- At 400px total width: Is the skyline silhouette still readable as a skyline?
- At 400px total width: Can you distinguish an active period from an inactive period?
- At 300px total width: Does the badge still look premium, or does it become visual noise?
- At all sizes: Is the badge identifiable as a Chapa badge (brand recognition)?

**Method**: Render the hero SVG at 100%, 50%, 33%, and 25% scale. Evaluate each.

### Phase 4: Two-Layer Depth Test

**Goal**: Validate that the depth layer (lifetime history) adds visual richness without cluttering the badge.

**Method**:
- Render the same user at 3 months, 6 months, 12 months, and 24 months of tenure
- Verify that longer tenure produces a visibly richer artifact
- Verify that the depth layer doesn't compete with the surface layer for attention

### Phase 5: Share Page Prototype

**Goal**: Animated timeline ("watch it form") working with real MetricsSnapshot data.

**Deliverable**: Interactive prototype on the share page showing the badge building up over time.

---

## 11. User Research & Validation Plan

Before committing the metaphor to production, validate with developers beyond Juan.

### Research Questions

1. Does the metaphor make developers *want* to embed this badge?
2. Do they understand (at least intuitively) that it represents their engineering activity?
3. Does the two-layer model (active surface + deep history) communicate meaningfully?
4. Is the "intriguing, then learnable" positioning actually intriguing, or just confusing?

### Validation Methods

#### Dogfooding (Phase 1)
- Juan uses his own Builder badge as primary test case
- Embed in his own GitHub profile and portfolio
- Daily assessment: does it still feel right after a week? A month?

#### Developer Showcase (Phase 2)
- Generate badges for 10–20 diverse developers (with permission)
- Range of archetypes, scores, tenure lengths
- Present side-by-side with the current heatmap badge
- Ask: "Which would you put on your profile?"

#### Community Feedback (Phase 3)
- Share mockups (not functional badges) on developer communities (Twitter/X, DEV.to, relevant Discords)
- Gauge reaction: intrigue, confusion, excitement, indifference
- Specifically test: does the metaphor earn clicks to the share page?

#### A/B Embed Test (Phase 4, post-launch)
- Offer both badge styles (heatmap legacy vs. metaphor) via Creator Studio
- Measure: which gets embedded more? Which drives more share-page visits?
- This is the definitive signal

### Success Criteria

A metaphor direction should survive if it can do ALL of the following:
- Still read as time-based developer activity
- Feel ownable to Chapa (not derivative of GitHub, GitCity, or any existing product)
- Look premium as static SVG
- Be identifiable from across the page (brand recognition at small sizes)
- Make developers want to share it

---

## 12. Risks & Mitigations

### Performance Budget for SVG Complexity

The current badge SVG must load fast when embedded on external pages.

**Constraints**:
- SVG file size: target under 50KB (current heatmap badge is ~15–25KB)
- No external resource loading (fonts must be embedded or system-fallback)
- No JavaScript in the SVG (pure SVG elements only for embeds)
- Rendering time: must paint in under 100ms on modern browsers

**Mitigation**: The architectural strip is composed of simple SVG primitives (rect, path, polygon). Complexity comes from quantity and arrangement, not from heavy graphical effects. Gradients and opacity layers should be used sparingly.

### Accessibility

Metaphorical visualizations are inherently less accessible than conventional charts. Baseline strategy:

**Badge (static SVG)**:
- `<title>` and `<desc>` elements in SVG with text description: "Builder badge for @handle: Delivery 78, Quality 65, Consistency 82, Breadth 45. Score: 68 High Impact."
- `role="img"` on the SVG element
- Color-blind safe: the metaphor should communicate through shape and density, not just color
- Sufficient contrast ratios for text elements within the badge

**Share page (animated)**:
- `prefers-reduced-motion`: disable timeline animation, show static final state
- Keyboard navigable timeline scrubber
- Screen reader alternative: text-based score breakdown alongside the visual
- ARIA labels on all interactive elements

### Design Complexity

The full vision (7 archetype-specific metaphors × 2 temporal layers × tenure progression) is a large design surface.

**Mitigation**: Aggressive phasing. v1 ships ONE metaphor with two layers. Archetype branching comes only after the base system is proven. The v1 renderer is parameterized (Section 5, "v2 Branching Support in v1") so branching doesn't require a rewrite.

### Derivative Risk

The Architectural Strip is adjacent to GitCity and CodeCity. The badge could be perceived as "another city thing."

**Mitigation**:
- Stay 2D and silhouette-based, not isometric or 3D
- Focus on structural rhythm and material quality, not toy buildings
- The depth layer (underground strata) is unique to Chapa — no other product does this
- The "forged" tone (heavy, engineered, consequential) differentiates from GitCity's playful aesthetic
- If prototyping reveals derivative feel, pivot to the Forged Artifact or Circuit metaphor within the same parameterized system

### The Metaphor Obscures the Data

Risk: users can't extract any meaning from the visual and just see "pretty shapes."

**Mitigation**:
- The right panel still shows the radar chart and composite score (v1 scope constraint)
- The share page provides full analytical breakdown in both emotional and analytical modes
- The "intriguing, then learnable" positioning embraces this: the badge is the hook, the share page is the explanation

---

## 13. Phased Roadmap

### Phase 1: Foundation (v1) — Builder Metaphor + Two Layers

**Scope**:
- Replace left-panel heatmap with Builder Architectural Strip
- Implement surface layer (current 365-day scores → visual properties)
- Implement depth layer (lifetime MetricsSnapshot → foundation/strata)
- Ensure tenure progression (more history = richer artifact)
- Honest decay (low activity = quieter surface)
- Right panel unchanged (radar + stats + score)
- Share page: animated timeline ("watch it form") + history comparison
- Both modes on share page (emotional default, analytical toggle)
- Parameterized renderer (MetaphorMapping interface for future archetype branching)

**Validation**: Dogfooding (Juan's badge), developer showcase, community feedback.

**Exit criteria**: The Builder badge feels ownable, premium, and worth embedding — confirmed by Juan and at least 5 external developers.

### Phase 2: Archetype Branching (v2)

**Scope**:
- Design and implement visual families for remaining archetypes
- Prioritize by user distribution (most common archetypes first)
- Each archetype uses the same MetaphorMapping interface, different config
- Archetype transitions visible in depth layer (if user changed archetype over time)

**Prerequisite**: Phase 1 shipped and validated.

### Phase 3: Share Page Rich Experience (v3)

**Scope**:
- Interactive deep dive (click into dimension breakdowns)
- Social proof layer (archetype community stats, percentile context)
- Archetype explorer ("if you were a Marathoner, your badge would look like this")

**Prerequisite**: Phase 2 shipped (multiple archetype visuals available to showcase).

### Phase 4: Full Badge Takeover (v4) — Evaluation Only

**Scope**: Evaluate whether the metaphor has proven strong enough to replace the radar chart and composite score display. If yes, redesign the badge to use the full canvas for the metaphor, moving all analytical content to the share page.

**This is not committed.** It depends entirely on how Phases 1–3 play out.

---

## Appendix A: What to Avoid

From the research document (Section 8), contextualized for this vision:

### "Just another chart"
The metaphor must not collapse into bars-with-hats. The architectural strip needs enough procedural sophistication to feel generated, not graphed.

### Overly literal skeuomorphism
The buildings should feel structural and abstract, not like toy houses or Minecraft blocks. The "forged" tone guides this: weight over whimsy.

### Too many dimensions at badge scale
Glyph research shows multivariate compact forms degrade fast with too many competing variables. At badge scale, the metaphor should communicate **2–3 signals clearly** (shape over time, density/regularity, refinement). Additional dimensions (Breadth, Craft) can be subtler texture or overlay signals. The full dimension breakdown lives on the share page.

### Losing chronology
The x-axis must remain temporal (left = older, right = recent). The architectural strip preserves this naturally. Future metaphors (constellation, force field) would need more care.

## Appendix B: Data Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     DATA SOURCES                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  GitHub API (365 days)    Claude Insights (optional)     │
│  └→ StatsData             └→ CraftResult                 │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                     SCORING ENGINE                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  computeImpactV6(stats, craftScore?)                     │
│  └→ ImpactV6Result                                       │
│     ├→ Dimensions: delivery, quality, consistency,       │
│     │   breadth, [craft]                                 │
│     ├→ Composite score, adjusted score                   │
│     ├→ Archetype, tier, confidence                       │
│     └→ EMA smoothing (0.85 previous + 0.15 current)     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                     STORAGE LAYERS                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Supabase (permanent)          Redis/Upstash (cache)     │
│  ├→ metrics_snapshots          ├→ stats per user/day     │
│  │  (1 per user/day,           ├→ impact per user/day    │
│  │   indefinite retention)     ├→ SVG per user/day/theme │
│  │  dimension scores,          └→ rate-limiting           │
│  │  archetype, tier,                                     │
│  │  composite score            TTL: 24h                  │
│  └→ [future: weekly shapes,                              │
│      activity patterns]        Fail-open on unavailable  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                   METAPHOR RENDERER                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  MetaphorMapping (parameterized)                         │
│  ├→ Surface: ImpactV6Result → visual properties          │
│  ├→ Depth: MetricsSnapshot[] → foundation properties     │
│  └→ Archetype config selects the mapping instance        │
│                                                          │
│  Output:                                                 │
│  ├→ Static SVG badge (left panel)                        │
│  └→ Animated share page (timeline, comparison)           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Appendix C: Glossary

| Term | Meaning |
|------|---------|
| Surface layer | The visual representation of current (365-day rolling) scoring data. Can rise and fall. |
| Depth layer | The visual representation of lifetime accumulated history. Only grows richer. |
| Tenure | Duration of MetricsSnapshot history. Longer tenure = richer depth layer. |
| Honest decay | When activity drops, the surface visually reflects it. No hiding. |
| MetaphorMapping | The interface that maps scoring dimensions to visual properties. Parameterized per archetype. |
| Architectural strip | A 2D procedural skyline/structure band. The Builder archetype's visual metaphor. |
| Hero SVG | A full-quality static rendering of the metaphor at badge dimensions (1200×630). |
| Small-size stress test | Testing whether the metaphor still communicates at embedded sizes (300–600px wide). |

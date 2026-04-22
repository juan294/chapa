# Chapa badge visualization research

## Goal

Find a replacement for the current GitHub-style square heatmap that still communicates **activity over time** and **intensity of activity**, fits inside the existing **rectangular badge area**, and feels **more distinctive, modern, and product-owned** than the default contribution-grid metaphor.

## The design problem in one sentence

You are not just replacing a chart. You are replacing the **visual grammar of “effort over time”** inside the badge, while keeping the rest of the badge stable.

That means the new form should preserve as much of the following as possible:

- **Cadence**: when activity happened
- **Intensity**: how much happened
- **Texture**: quiet vs busy periods
- **Scanability**: readable in a small badge
- **Identity**: feels like Chapa, not like GitHub

## Constraints inferred from the current badge

- The activity block has to stay **wide and rectangular**.
- It needs to read well at **badge scale**, not only in a full profile page.
- It should work for roughly **90 days** of data.
- It should support a **dark UI** and likely a **single-brand accent color** with intensity variation.
- It should not require the rest of the badge to move around.
- It should ideally preserve **hoverability** or per-day tooltip support if used on the web.

## What the research says matters in small spaces

For compact visualizations, the main tradeoff is always between **precision** and **density**. Sparklines and horizon charts are explicitly recommended for small spaces because they preserve trend information while using very little room, but they become weaker when the viewer needs exact values or exact day-by-day boundaries. Barcode or event-style charts do the opposite: they preserve individual occurrences and cadence extremely well, but they usually need careful styling to avoid looking too raw or too sparse.

That tradeoff is the key lens for Chapa. The current square grid is strong at **daily discreteness** and **streak texture**, but visually it is heavily associated with GitHub. The best alternative is therefore not just “a prettier chart”; it is a form that either:

1. preserves discrete daily rhythm while changing the metaphor, or
2. intentionally moves to a more continuous signal if that better supports the Chapa brand.

## Candidate options considered

### 1. Horizon strip / horizon ribbon

#### What it is

A horizon chart is a compact time-series technique that compresses an area chart into layered color bands. Instead of using full vertical height for the value at each time point, the value range is split into bands and those bands are overlaid. The result is a dense, compact trend display that can show much more information in less vertical space than a standard line or area chart.

#### Why it is promising for Chapa

This is the strongest option if you want the badge to feel more like a **designed product metric** and less like a cloned contribution graph.

A Chapa adaptation would look like a **single continuous ribbon** running left to right across 90 days. Activity intensity would be encoded by layered bands, opacity, or tonal steps of the brand purple. Quiet periods would collapse into a thin baseline. Intense bursts would rise into stacked bands that feel almost topographic or audio-reactive.

Visually, this gives you:

- a strong sense of **momentum**
- more premium, editorial, or dashboard-like aesthetics
- a clear break from GitHub’s square cells
- good use of the existing wide rectangular space

#### What it preserves well

- trend direction
- periods of sustained intensity
- contrast between calm and busy stretches
- compactness

#### What it loses compared with the current heatmap

- exact daily cell boundaries
- the familiar “streak wall” feeling of GitHub contributions
- immediate counting of active vs inactive days

#### Why it stands out

Among standard chart types, horizon charts are still relatively uncommon in product UIs. They have stronger visualization pedigree than many trendy alternatives, but are not yet visually overused in profile products, portfolio products, or developer tools.

#### Best Chapa-specific implementation

**Recommended variant:** a **single-series horizon ribbon** with 3 or 4 intensity bands.

Suggested mapping:

- **x-axis:** day index over 90 days
- **value:** weighted daily impact score or daily activity score
- **bands:** 3 or 4 discrete tiers
- **color:** one hue family, brighter or denser as intensity increases
- **shape:** smoothed but not overly curved; preserve some daily jaggedness

#### Styling guidance

- Use a **soft baseline glow** only on the active ribbon, not the whole panel.
- Keep the band transitions visible; do not blur them so much that the chart becomes generic neon decoration.
- Consider slight **corner clipping or mask framing** so the strip still feels badge-native.
- Add subtle **weekly separators** only if tooltips are absent; otherwise keep the strip uninterrupted.

#### Verdict

This is the best option if the objective is:

> “Make Chapa look like its own product language, even if we sacrifice some of GitHub’s day-cell familiarity.”

---

### 2. Barcode pulse strip / event-raster strip

#### What it is

A barcode plot, instance chart, or event-style raster uses thin marks positioned along a time axis to show when events occurred. In dataviz practice, barcode plots are used to show distributions or occurrences, and event/raster plots are widely used to show the timing of many events across a shared axis.

#### Why it is promising for Chapa

This is the strongest option if you want to preserve the **daily, discrete, “I can feel the rhythm of work”** character of the current heatmap without keeping the square grid.

A Chapa adaptation would use **90 narrow vertical pulses** instead of 90 cells. Each day becomes a slim mark. Intensity can be encoded through one or more of the following:

- line height
- stroke thickness
- opacity
- inner glow
- slight vertical spread or stacked micro-segments

That produces something closer to **telemetry**, **signal processing**, or **activity sensing** than a contribution calendar.

#### What it preserves well

- daily discreteness
- burstiness and droughts
- cadence and streak perception
- easy tooltip mapping per day
- compact use of a wide horizontal region

#### What it loses compared with the current heatmap

- the spatial grouping benefit of rows and columns
- the familiar weekly chunking users know from GitHub
- some perceived “mass” unless styling is done well

#### Why it stands out

This option is modern without being flashy. It feels technical, accurate, and distinct. It can also look excellent in motion if you ever animate badge loading or transitions.

It is also more flexible than the square grid because you can tune the marks to feel minimal, premium, or energetic without changing the underlying data model.

#### Best Chapa-specific implementation

**Recommended variant:** a **pulse strip** with rounded micro-bars or glowing needles.

Suggested mapping:

- **x-axis:** day index over 90 days
- **mark per day:** one vertical pulse
- **intensity:** height + opacity, optionally thickness as a third channel
- **inactive day:** tiny baseline tick rather than fully blank space, so the timeline remains continuous
- **weekly rhythm:** optional faint separators every 7 days

Two especially interesting subvariants:

##### Variant A — Signal pulse

Very thin vertical lines, like a monitored signal. Cleanest and most technical.

##### Variant B — Capsule skyline

Rounded micro-bars packed tightly together. Slightly more substantial and more premium at small sizes.

#### Styling guidance

- Avoid pure equal-width bars that look like a stock chart.
- Keep marks tightly packed so the strip reads as a field, not as a bar chart.
- Use one quiet baseline for zero or near-zero days to preserve continuity.
- A very subtle bloom on high-activity days can make standout days feel special without needing multiple colors.

#### Verdict

This is the best option if the objective is:

> “Keep the sense of daily cadence and contribution texture, but stop looking like GitHub.”

---

### 3. Why not just use a sparkline?

A sparkline is excellent in small spaces, but here it is probably too generic and too weak as a primary hero texture. It would communicate trend, but not enough of the **field-like activity texture** that currently makes the badge feel substantial.

In other words: a sparkline would work as a secondary supporting signal, but probably not as a full replacement for the main activity block.

---

### 4. Why not use a temporal carpet or another grid variant?

A temporal raster or carpet plot can show time-based relations very effectively, but it tends to drift back toward a matrix or grid reading. For Chapa, that does not create enough visual distance from the current GitHub-derived metaphor.

If the goal is a true form-factor shift, it is better to move either toward a **continuous ribbon** or a **discrete pulse strip**.

## Final recommendation

## Preferred direction: Barcode pulse strip

If I were choosing the safest, highest-upside transition for Chapa right now, I would move to the **barcode pulse strip** first.

### Why

It gives you the best balance of:

- **visual novelty**
- **rectangular fit**
- **day-by-day readability**
- **streak and cadence retention**
- **implementation simplicity**
- **easy transition from current data model**

It is the least risky move because it changes the metaphor while keeping the user’s mental model mostly intact: time still progresses left to right, each day still has a distinct visual mark, and more activity still looks denser, taller, brighter, or thicker.

That makes it a clean migration path.

## Second direction: Horizon ribbon

If the goal is a stronger visual identity jump and a more productized, premium feel, then the **horizon ribbon** is the better long-term design language.

It is more differentiated, more memorable, and more ownable. But it is also a bigger semantic shift because it trades discrete daily texture for a more continuous trend signal.

My read is that this is the better **v2 or exploratory branch**, especially if Chapa is leaning toward a more polished analytics-product identity rather than a developer-contribution identity.

## Decision framework

Use this simple rule:

### Choose **barcode pulse strip** if:

- you want a low-risk visual departure from GitHub
- you want to preserve daily rhythm and tooltip logic
- you want the result to feel technical and modern
- you may still want users to mentally read “activity log”

### Choose **horizon ribbon** if:

- you want a clearer brand break from GitHub
- you want the badge to feel more premium and product-designed
- you are comfortable prioritizing trends over exact daily discreteness
- you want the activity block to look more unique and less like a conventional developer graph

## My recommendation in plain language

For Chapa specifically:

1. **Build the barcode pulse strip first.** It is the best immediate replacement.
2. **Prototype the horizon ribbon in parallel** as the bolder visual direction.
3. Compare them at real badge sizes, not only full-screen mockups.

If the pulse strip still feels too close to a conventional developer activity graph, then move decisively to the horizon ribbon.

## Suggested prototype specs

### Prototype A — Barcode pulse strip

- 90 daily marks
- fixed-width strip
- rounded pulses
- intensity mapped to height + opacity
- optional weekly separators
- hover per day
- zero-day baseline tick retained

### Prototype B — Horizon ribbon

- 90 daily values interpolated with restrained smoothing
- 3 or 4 stacked bands
- brand-purple sequential intensity
- no axis labels in badge view
- hover uses invisible daily bins above the ribbon

## What to test before deciding

Evaluate both prototypes on these five questions:

1. **Can someone instantly tell when activity was dense or sparse?**
2. **Does it still feel credible as an activity metric, not decorative art?**
3. **Does it survive reduction to actual badge size?**
4. **Does it feel like Chapa rather than a reused GitHub pattern?**
5. **Can engineering map it cleanly from the existing daily activity model?**

## Bottom line

If the current square heatmap is the GitHub inheritance layer, the next Chapa-native step should be one of these two:

- **Barcode pulse strip** for the best near-term balance of familiarity and originality
- **Horizon ribbon** for the strongest long-term product identity

If I had to pick only one for immediate implementation, I would pick:

# **Barcode pulse strip**

And if I had to pick one for the most differentiated brand language over time, I would pick:

# **Horizon ribbon**

## Sources consulted

- Heer, Kong, Agrawala — *Sizing the Horizon: The Effects of Chart Size and Layering on the Graphical Perception of Time Series Visualizations* (CHI 2009)
- Observable — *Deliver big insights in small spaces*
- Observable — *Five underused charts for richer dashboards*
- Observable — *Beyond bar charts: A guide to advanced visualizations in Observable Plot*
- Observable D3 example — *Horizon chart*
- The Data Visualisation Catalogue Blog — *Chart Snapshot: Barcode Plots*
- Matplotlib documentation — *eventplot*
- Edward Tufte — *Sparkline theory and practice*


---

## Creative expansion: signature visual languages beyond standard charts

The strongest insight after moving past direct “heatmap replacement” thinking is that Chapa does not need another familiar chart type. It needs a **signature visual language**: something that still reads as activity over time, but feels native to Chapa rather than inherited from GitHub.

The current contribution grid is a storage format disguised as a chart. It is familiar, but not inevitable. The opportunity is to replace it with a visual metaphor that communicates rhythm, intensity, identity, and proof in a way that can become distinctive to the product.

Below are the most promising directions.

### 1. Temporal fingerprint

A continuous fingerprint-like field made of flowing ridges or contour lines across the rectangle. Each ridge represents intensity bands over time, producing something between a topographic strip and an identity signature.

**Why it is compelling**
- Feels proprietary rather than borrowed
- Maps naturally to the idea of a personal developer signature
- Works very well in SVG through layered paths, masks, and gradients
- Can feel premium without losing technical seriousness

**Data mapping**
- X axis = time
- Ridge height / density = activity intensity
- Compression = bursts
- Smoothness = consistency
- Inner glow or micro-grain = confidence / verification / quality

**Main strength**
This is the best concept if Chapa wants the activity panel to become a visual identity system rather than just a metric view.

**Main risk**
It can become decorative if the temporal rhythm is not clearly preserved.

### 2. Magnetic field lines

A horizontal field of curved trajectories that bend around high-activity periods like invisible attractors. Quiet periods flatten the field; intense periods distort it.

**Why it is compelling**
- Unusual and memorable
- Suggests force, pull, influence, and impact
- Looks technical and alive at the same time
- Works well in SVG with layered bezier paths and opacity

**Data mapping**
- X axis = time
- Attractor strength = activity intensity
- Coherence = quality / craft
- Spread = breadth
- Regularity = consistency

**Main strength**
One of the most distinctive ways to visualize “impact” instead of just “count.”

**Main risk**
Without subtle temporal anchors, users may read it as an abstract decorative field.

### 3. Pulse fabric

A woven digital textile where time-based impulses compress, brighten, or distort a field of threads. Active periods create tension in the weave; quiet periods relax it.

**Why it is compelling**
- Implies craft and accumulated work
- Visually rich while still rectilinear
- Suitable for SVG through repeated strokes, masks, and distortion

**Data mapping**
- X axis = time
- Brightness / compression = activity intensity
- Evenness = consistency
- Secondary strands = breadth

**Main strength**
Feels like work becoming structure, which is a strong metaphor for engineering.

**Main risk**
Can drift too far into art direction unless kept highly technical.

### 4. Seismic ribbon

A layered, seismograph-inspired band that behaves like compressed geological pressure over time. Bursts cut into the strata; quiet periods flatten them.

**Why it is compelling**
- Conveys pressure, motion, and accumulated effort
- Has more weight and seriousness than a sparkline
- Excellent SVG fit as stacked paths

**Data mapping**
- X axis = time
- Ridge amplitude = activity level
- Sharp cuts = burst events
- Cohesion = quality / craft

**Main strength**
Feels consequential and performance-oriented.

**Main risk**
Could drift toward finance or audio-chart aesthetics if not differentiated.

### 5. Code aurora

A restrained aurora-like veil or plasma ribbon that brightens and thickens during active periods, with faint time anchors behind it.

**Why it is compelling**
- Premium and emotionally resonant
- Very different from developer dashboards
- Great for a dark UI and SVG gradient language

**Data mapping**
- X axis = time
- Height / luminosity = activity intensity
- Smoothness = consistency
- Layer interactions = multi-dimensional strength

**Main strength**
One of the most visually striking options for a brand-forward badge.

**Main risk**
Easy to over-style into wallpaper.

### 6. Impact lattice

A diagonal or hex-derived structure where days energize nodes and links rather than filling boxes. Instead of lighting cells, the badge lights connections.

**Why it is compelling**
- Still structured and discrete
- Suggests systems thinking and engineering
- More original than a square heatmap while retaining legibility

**Data mapping**
- Time progresses through repeated columns
- Activity intensity = number of active connections
- Breadth = branching complexity
- Quality = confidence / sharpness of activated segments

**Main strength**
A practical middle ground between innovation and readability.

**Main risk**
Still adjacent to grid thinking unless the geometry is made distinctive.

### 7. Constellation track

A sparse sky-map-like field where days become linked points, clusters, and trails. High-activity periods generate brighter, denser local constellations.

**Why it is compelling**
- Highly brandable
- Each profile can gain a unique silhouette
- Works elegantly in SVG

**Data mapping**
- X axis = time
- Point density / brightness = intensity
- Linking structure = continuity and rhythm
- Cluster diversity = breadth

**Main strength**
Transforms activity history into a memorable personal pattern.

**Main risk**
Can feel too poetic unless grounded in technical styling.

### 8. DNA helix strip

A compressed horizontal helix where twist density, width, or glow changes over time, turning work rhythm into coded identity.

**Why it is compelling**
- Strong identity metaphor
- Distinctive if rendered with restraint
- Good SVG fit through repeated paths and masking

**Main strength**
Memorable and conceptually tied to encoded personal patterns.

**Main risk**
Too literal unless handled very subtly.

### 9. Interference bands

Several translucent bands, each representing a different dimension such as delivery, consistency, craft, or breadth, overlap and reinforce one another. Bright, sharp regions show alignment across dimensions.

**Why it is compelling**
- Encodes multiple metrics at once
- Feels computational and modern
- Creates a rich but compact strip

**Data mapping**
- X axis = time
- Each band = one metric family
- Constructive overlap = strong composite performance
- Divergence = uneven performance

**Main strength**
One of the most intelligent directions if Chapa wants to show that it measures more than raw volume.

**Main risk**
Needs careful tuning so the graphic does not become muddy at small size.

### 10. Compression skyline

A thin architectural skyline generated from the 90-day history, where each day becomes a stylized vertical form rather than a plain bar.

**Why it is compelling**
- Structured and readable
- Metaphorically connects developer work with building
- Can feel sharper and more iconic than standard bars

**Main strength**
A product-friendly alternative if the team wants novelty without sacrificing scanability.

**Main risk**
Too close to bars unless the forms are heavily stylized.

## Recommended prototype set

The three strongest directions for an exploratory design sprint are:

### Concept A — Chapa Fingerprint
A layered contour strip with nested ridges and compressed zones that reveal the developer’s unique work signature over time.

**Why prototype it**
- Best balance of originality and meaning
- Strongest candidate for a proprietary Chapa visual language
- Excellent SVG fit

### Concept B — Chapa Interference
Three to four translucent wave bands representing distinct dimensions that combine into bright zones of aligned performance.

**Why prototype it**
- Best concept for multi-factor storytelling
- Communicates that Chapa measures more than count activity
- Modern and computational without feeling generic

### Concept C — Chapa Field
A set of magnetic-field-like trajectories bent by impact density over time.

**Why prototype it**
- Boldest and most futuristic direction
- Directly evokes the idea of “impact”
- Distinctive enough to stand apart from most product dashboards

## Updated recommendation

If Chapa wants the safest near-term transition away from GitHub squares while preserving day-by-day rhythm, the **barcode pulse strip** remains the strongest pragmatic step.

If Chapa wants the most differentiated long-term brand language, the strongest original directions are now:

1. **Temporal fingerprint**
2. **Interference bands**
3. **Magnetic field lines**

These three are the best candidates for creating a truly proprietary badge visual that feels like Chapa invented it for this purpose.

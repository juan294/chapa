
# Metaphor-First Visualization Research for Chapa Badge

## Dense research brief

**Goal.** Research metaphor-first visualization directions for a rectangular, SVG-native Chapa badge that currently uses a GitHub-style square heatmap. The goal is **not** to find another conventional chart, but to identify metaphor-driven visual systems that can turn developer metrics into a more ownable, memorable, and product-defining artifact.

**Scope.**
- Focus on **metaphor-first** and **identity-first** visualizations rather than ordinary chart substitutions.
- Ground recommendations in visualization literature, software visualization research, personal informatics / self-reflection research, glyph studies, and compact time-series design.
- Evaluate ideas specifically for a **developer-facing**, **badge-sized**, **SVG-renderable**, **screenshotable**, **brandable** artifact.

---

## Executive summary

The literature strongly suggests that metaphor-driven visualizations work best when they do **more than decorate data**. The metaphor needs to provide a useful mental model, preserve enough data fidelity for the intended task, and remain consistent in how visual properties map to meaning.[^1][^2][^3][^4]

For Chapa, that matters because the badge is not only an analytic display; it is also a **self-representational artifact**. Research on personal visualization and personal physicalization shows that when people see their own data as something more tangible, expressive, and personalized, it can increase reflection, interpretation, and attachment.[^5][^6][^7] That is directly relevant to a developer badge: the graphic is not just reporting activity, it is helping a developer *recognize themselves* in it.

The software-visualization literature also shows that metaphors already matter in developer tools. The **city metaphor** persists because it gives orientation, locality, and intuitive structure to complex software, and it continues to attract research and derivatives.[^8][^9][^10][^11] Likewise, **map metaphors** remain useful because they help users correlate information spread across complex systems, even if the evidence base is uneven.[^12][^13]

Taken together, the strongest conclusion is this:

> Chapa should not merely replace the GitHub grid with a prettier chart.  
> It should turn developer behavior into a **signature object**.

From the literature and the design constraints, the most promising metaphor-first directions are:

1. **Topographic Signature** — best overall balance of novelty, brandability, and SVG feasibility  
2. **Circuit Signature** — strongest engineering fit and best path to multi-metric encoding  
3. **Architectural Strip** — most legible metaphor and closest to the proven "city" lineage  
4. **Constellation Field** — most poetic and screenshot-worthy, but more abstract  
5. **Woven Fabric / Pulse Fabric** — strong "crafted over time" metaphor, but easier to over-stylize  
6. **Magnetic / Force Field** — highly distinctive, strong "impact" metaphor, but less literal

My recommendation is to prototype first around **Topographic Signature**, **Circuit Signature**, and **Architectural Strip**. They offer the best combination of:
- metaphor strength,
- rectangular layout compatibility,
- SVG implementation practicality,
- support for 90-day temporal data,
- and long-term Chapa brand distinctiveness.

---

## 1. Why a metaphor-first approach makes sense for Chapa

### 1.1 The current GitHub heatmap is familiar, but not ownable

The contribution grid is powerful because it is compact, habitual, and easy to scan. But it is also a visual trope. It carries GitHub's identity more strongly than yours. A derivative version will almost always read as "GitHub-inspired" rather than "Chapa-native."

### 1.2 Metaphors can create understanding, identity, and memorability

Research on metaphor-based design treats metaphor as a way to understand one domain in terms of another. In visualization, that can be beneficial when the source domain provides a useful organizing model for the target data.[^1][^3][^14] In software visualization, city and map metaphors work precisely because they provide familiar orientation structures for complex, abstract systems.[^8][^12]

### 1.3 Chapa is also a personal visualization problem

Chapa badges are not only analytical; they are social, expressive, and identity-bearing. Work on personal visualization and constructive / personal physicalization shows that people engage differently with data when it becomes more tangible, personalized, and meaning-rich.[^5][^6][^7] That argues for a representation that feels like **a generated artifact of a developer's behavior**, not just a dashboard component.

---

## 2. What the literature says about metaphor in visualization

### 2.1 Metaphors are useful when they transfer structure, not just aesthetics

A useful metaphor does not merely "skin" a chart. It transfers a structural idea from a familiar domain to an unfamiliar one.[^1][^3][^14] In practice, that means the metaphor should help with one or more of:
- orientation,
- grouping,
- causality,
- movement through time,
- comparison,
- or memory.

That is why the city metaphor in software visualization has endured: districts, buildings, proximity, and skyline all carry interpretable meaning.[^8][^9][^10][^11]

### 2.2 Metaphors need discipline

There is a recurring warning in the literature: metaphors can also distort understanding if they become too ornamental, too literal in the wrong way, or too detached from the user's actual task.[^1][^4][^14] For Chapa, that means:
- the metaphor cannot obscure that this is a 90-day performance trace,
- it should preserve at least a light sense of chronology,
- and it must survive extreme compression inside an SVG badge.

### 2.3 Personal and reflective data can benefit from expressive representations

Personal-data research suggests expressive forms can increase engagement and reflection, but they also need to avoid pushing users into confusing or overly emotional interpretations.[^5][^6][^7] That balance matters for Chapa: the output should feel special, but it must still be credible.

### 2.4 Glyph and compact time-series research still matters

Even if Chapa moves toward metaphor, it still inherits constraints from **compact time-series** and **small-display** visualization. Work on horizon graphs, glyphs, and compact time-series design is relevant because it shows how much information can survive compression and which encodings break down first.[^15][^16][^17][^18][^19]

Two practical implications:
- preserving **x-position as time** is valuable whenever possible;
- small-multiple or highly multivariate forms need careful visual hierarchy, because badge-sized glyphs can become illegible quickly.[^17][^18]

---

## 3. Lessons from software-visualization research

### 3.1 The city metaphor is proven, but mostly in exploratory contexts

The city metaphor remains one of the strongest families in software visualization. CodeCity and later work show that representing software systems as districts and buildings creates locality and helps exploration.[^8][^9] A 2024 systematic mapping study found the city metaphor is still active and influential in software visualization research.[^10]

However, most city-metaphor systems target **exploration of large software systems**, not compact personal badges.[^10][^11] That means Chapa should probably borrow the *logic* of the metaphor, not the full 3D implementation.

### 3.2 Map metaphors are also durable

The code-map literature suggests map-like visualizations can help developers discover and correlate information across a codebase, although the quantitative evidence is still limited.[^12] Software maps also provide a rich palette of visual variables and configuration choices.[^13] This matters because it suggests terrain / cartographic metaphors are not just artistic; they have an established cognitive role in software environments.

### 3.3 "Landscape" metaphors can scale down

Software landscape visualizations such as ExplorViz show that landscape-style abstractions can represent complex application environments and have been evaluated in program-comprehension settings.[^20] That makes landscape- and terrain-like metaphors especially interesting for Chapa because they can be flattened into a 2D strip more naturally than a full city.

### 3.4 Evidence supports metaphor when mappings are meaningful

The strongest software-visualization lesson is not "cities are cool." It is this:

> metaphor becomes useful when the mapping from metric to visual property is stable, interpretable, and task-relevant.[^8][^10][^11][^12][^13]

That principle should guide Chapa more than any one visual style.

---

## 4. Design criteria for Chapa

I used the following criteria to assess concept families:

1. **Temporal fidelity** — can a viewer still sense 90-day progression?
2. **SVG feasibility** — can it be rendered crisply and efficiently in SVG?
3. **Badge fit** — does it work in a low-height rectangular region?
4. **Brandability** — can it become a recognizable Chapa signature?
5. **Metric flexibility** — can it encode more than one dimension over time?
6. **Legibility at a glance** — does it survive README / portfolio embed size?
7. **Screenshot appeal** — does it look special enough to share?
8. **Developer resonance** — does it feel at home in a technical product?

---

## 5. Metaphor-first concept families

## 5.1 Topographic Signature

### Description
A horizontally compressed terrain or relief map generated from 90 days of activity and derived metrics. Peaks represent high-intensity periods, plateau smoothness represents consistency, local texture can represent breadth or craft, and contour density can encode additional magnitude layers.

### Why the literature supports it
Map-like visualization is a long-standing metaphor for representing non-spatial information spatially.[^3] Software maps and software landscapes show that developers already accept cartographic metaphors in analytic tools.[^12][^13][^20]

### Why it fits Chapa
- strong sense of **identity** and "shape"
- clearly rectangular and SVG-friendly
- can feel premium rather than dashboard-like
- easy to brand as "your engineering terrain"

### Risks
- too much contour density can become mush at small sizes
- terrain can overemphasize overall shape at the expense of daily discreteness

### SVG implementation notes
- layered contour paths
- optional contour labels or ridge markers removed in small sizes
- use opacity / line-weight hierarchy instead of too many color bands
- could animate subtly in richer contexts, but static badge should remain clear

### Verdict
**Best overall candidate.**

---

## 5.2 Circuit Signature

### Description
A circuit-board-like network energized over time. Time progresses left to right, but instead of bars or cells, activity illuminates traces, nodes, and junctions. More active days activate more branches or brighter segments. Additional dimensions can modify path thickness, branching complexity, pulse density, or node behavior.

### Why the literature supports it
This concept is less directly represented in the literature than city or map metaphors, but it aligns with the broader metaphor principle: use a familiar source domain that matches user expectations and task structure.[^1][^14] For developers, circuitry is a highly resonant technical source domain.

### Why it fits Chapa
- immediately "engineering-coded"
- good path for multi-metric fusion
- can look unmistakably proprietary
- works well as an SVG because traces and nodes are path primitives

### Risks
- can become decorative cyberpunk if the data mapping is weak
- branching must be restrained or it becomes noisy in a badge

### Best data mappings
- x = time
- number of active branches = activity volume
- node glow = impact / verification / confidence
- path coherence = consistency
- branch diversity = breadth

### Verdict
**Best engineering-native metaphor.**

---

## 5.3 Architectural Strip

### Description
A flattened skyline or procedural architecture strip derived from activity and other dimensions. Instead of a full 3D city, each day becomes a micro-structure or façade segment. Over 90 days, the badge reads as a built environment or engineered skyline.

### Why the literature supports it
This is the most direct descendant of the city metaphor literature, which has a strong software-visualization lineage and sustained research presence.[^8][^9][^10][^11] GitCity's recent popularity also shows that the city metaphor remains legible, fun, and shareable in developer culture.[^21][^22]

### Why it fits Chapa
- very legible at a glance
- strongest bridge from GitHub activity to a more novel but still understandable form
- conceptually aligned with "building"
- screenshot-friendly

### Risks
- easiest to feel derivative of GitCity / CodeCity if handled too literally
- can collapse into "bars with hats" if not designed with enough sophistication

### Best direction
Make it more **architectural strip** than **3D city**:
- minimal silhouettes
- structural rhythm
- layered façades
- subtle districting
- no obvious isometric perspective in the badge itself

### Verdict
**Safest metaphor-first transition.**

---

## 5.4 Constellation Field

### Description
A star-map style field where each day becomes a point event and periods of related activity create brighter clusters and connective links. Strong work periods appear as dense stellar regions; consistency can produce a smooth arc; breadth can produce branching constellations.

### Why the literature supports it
Less directly represented in software visualization research, but well supported by general metaphor principles and by the use of expressive representations in personal and reflective data contexts.[^5][^6][^14]

### Why it fits Chapa
- elegant and highly shareable
- could create unique "signature sky" patterns
- good for expressing identity more than volume

### Risks
- more abstract than terrain or architecture
- harder to preserve strict chronology
- can become too poetic unless kept technical

### Verdict
**High brand value, lower raw fidelity.**

---

## 5.5 Woven / Pulse Fabric

### Description
A woven field or digital textile where temporal activity creates tension, density, and brightness in a structured weave. Over time, the badge looks like a technical fabric forged from repeated work patterns.

### Why the literature supports it
Not a standard software metaphor, but it aligns with personal-expression and materialization research: making data feel like an artifact or material can increase attachment and meaning.[^5][^6][^7]

### Why it fits Chapa
- strong "crafted over time" story
- visually rich without requiring 3D
- could become highly ownable

### Risks
- easiest to drift into decorative generative art
- may feel less obviously "developer" than terrain, circuits, or architecture

### Verdict
**Interesting secondary direction, but weaker semantic fit.**

---

## 5.6 Magnetic / Force Field

### Description
An energy field where high-impact periods act like attractors that bend and compress lines across the panel. The result reads as a field of influence rather than a discrete record.

### Why the literature supports it
This is more speculative, but metaphor theory supports it where the source domain helps users reason about an abstract target.[^1][^14] "Impact" maps naturally to "force."

### Why it fits Chapa
- strong emotional / conceptual fit with the word "impact"
- very distinctive and futuristic
- path-based SVGs can render this cleanly

### Risks
- weaker day-by-day legibility
- could look like a wallpaper effect if not anchored by subtle temporal scaffolding

### Verdict
**Very strong branding move, weaker literal time-series move.**

---

## 6. Scorecard

| Concept | Temporal fidelity | SVG feasibility | Badge fit | Brandability | Metric flexibility | Glance legibility | Developer resonance | Overall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Topographic Signature | 4 | 5 | 5 | 5 | 4 | 4 | 4 | **31** |
| Circuit Signature | 4 | 5 | 4 | 5 | 5 | 3 | 5 | **31** |
| Architectural Strip | 4 | 5 | 5 | 4 | 4 | 5 | 5 | **32** |
| Constellation Field | 3 | 5 | 4 | 5 | 4 | 3 | 3 | **27** |
| Woven / Pulse Fabric | 3 | 4 | 4 | 4 | 4 | 3 | 3 | **25** |
| Magnetic / Force Field | 2 | 5 | 4 | 5 | 4 | 3 | 4 | **27** |

### Reading the scorecard
The numerical score helps compare tradeoffs, but I would not mechanically choose the highest. The most important distinction is strategic:

- **Architectural Strip** is the most **immediately legible**
- **Topographic Signature** is the most **balanced**
- **Circuit Signature** is the most **developer-native and extensible**

If Chapa wants the best mix of novelty and safety, start with **Topographic Signature** and **Architectural Strip**.  
If Chapa wants to create a more defensible visual language around its own metric model, **Circuit Signature** is the bolder long-term bet.

---

## 7. Which concepts best match Chapa's product philosophy?

Chapa is not just counting output. It is trying to show a more nuanced model of developer contribution in the AI-assisted era. That means the left-side visual should ideally communicate:

- **rhythm**
- **density**
- **pattern**
- **build quality or coherence**
- **multi-dimensionality**
- and **identity**

Against that standard:

### Topographic Signature
Best for: **pattern + identity + sustained effort**  
Narrative: "This is the terrain of your last 90 days."

### Circuit Signature
Best for: **multi-dimensionality + technical identity + systems thinking**  
Narrative: "This is your energized engineering graph."

### Architectural Strip
Best for: **building + visibility + easy social comprehension**  
Narrative: "This is the structure you built over time."

### Constellation Field
Best for: **personal uniqueness + screenshot appeal**  
Narrative: "This is your developer sky."

### Magnetic / Force Field
Best for: **impact + influence + distinctiveness**  
Narrative: "This is the field your work creates."

---

## 8. A note on what to avoid

The literature and the design constraints both suggest avoiding a few traps:

### 8.1 "Just another chart"
Simple bars, lines, areas, or ordinary sparklines may be efficient, but they are unlikely to create a defendable visual identity.

### 8.2 Overly literal skeuomorphism
If the city looks like toy buildings or the circuit looks like generic neon motherboard art, the metaphor starts to weaken credibility.

### 8.3 Too many dimensions at badge scale
Glyph research repeatedly shows that multivariate compact forms can degrade fast when too many variables compete for attention.[^17][^18] Chapa should decide which signals matter in the badge and leave deeper decomposition for the product UI.

### 8.4 Losing chronology entirely
Even in metaphor-first representations, keeping a left-to-right temporal skeleton is valuable. Horizon-graph and compact time-series research reinforce how much viewers benefit from stable time positioning.[^15][^16][^19]

---

## 9. Recommendation

### Recommended prototyping order

#### 1. Topographic Signature
Prototype first because it best balances:
- brandability,
- chronology,
- premium feel,
- SVG practicality,
- and metaphor strength.

#### 2. Circuit Signature
Prototype second because it may offer the best long-term path for Chapa's distinctive multi-metric model.

#### 3. Architectural Strip
Prototype third because it gives you a high-legibility, socially shareable fallback grounded in a proven metaphor family.

### Recommendation in one sentence
If Chapa wants to stop looking GitHub-derived and start looking category-defining, it should evolve the left-side badge panel into a **metaphor-first signature object**, with **Topographic Signature** as the strongest first bet.

---

## 10. Suggested next design sprint

For each of the three lead directions, build:
1. a **hero SVG mockup**,
2. a **data mapping spec**,
3. and a **small-size stress test**.

### Prototype A — Topographic Signature
Test whether contours, ridges, and plateaus remain legible at README size.

### Prototype B — Circuit Signature
Test whether traces and nodes can encode multiple dimensions without noise.

### Prototype C — Architectural Strip
Test whether the output feels "built" but not derivative of GitCity or CodeCity.

### Success criteria
A concept should survive if it can do all of the following:
- still read as time-based developer activity,
- feel ownable to Chapa,
- look premium as static SVG,
- and be identifiable from across the page.

---

## References


---

## Addendum — Market pulse and metaphor appetite (2026)

A fresh scan of current products, launch pages, and recent software-visualization literature suggests that the center of gravity has moved away from "better conventional charts" and toward **identity artifacts**: outputs that turn behavioral data into something more personal, metaphorical, and shareable.[^23][^24][^25] In other words, people seem more excited by "this is *me* in code" than by "this is my dataset rendered more cleanly."

### Why this matters for Chapa

This matters because Chapa is not just a telemetry widget. It is a public-facing badge. That means its visual core competes less with dashboards and more with:
- personal identity graphics,
- showcase artifacts,
- generated signatures,
- social-share visuals,
- and "wrapped"-style summary objects.[^23][^26]

The clearest signal here is **GitCity**, which turns GitHub contributions into a driveable 3D city. Its appeal is not only novelty; it is the strength of the metaphor. The user can instantly understand the mapping: activity becomes buildings, consistency becomes skyline character, and the result feels like a world they built.[^23] This lines up with longer-running software-visualization research, where the city metaphor remains durable precisely because it gives users orientation, locality, and meaningful structure rather than mere decoration.[^24][^25][^27][^28]

### Reading the current sentiment

The current sentiment appears to reward visual systems that are:

**1. More symbolic than literal.**  
Users are receptive to metrics being transformed into artifacts, provided the metaphor still feels legible and grounded.

**2. More self-representational than purely analytical.**  
A visualization that helps users *identify with* the output tends to be more memorable and more shareable.[^26]

**3. More experiential than dashboard-like.**  
The strongest current examples feel like generated objects, worlds, or scenes rather than standard productivity charts.[^23][^29]

**4. More ownable as product language.**  
A unique metaphor can become part of the product identity in a way that a reused chart type usually cannot.

### What this suggests for metaphor exploration

The implication for Chapa is that it should likely shift from asking:

> "What chart should replace the square heatmap?"

to asking:

> "What generated artifact should represent a developer's engineering pattern?"

That framing opens a much stronger metaphor space for the product.

### Ranked metaphor families to explore next

#### 1. Forged artifact
This family feels especially aligned with Chapa's current tone and copy ("forged from purpose"). Instead of a chart, the left panel becomes an object that looks heat-treated, layered, etched, machined, or pressure-formed by the user's engineering behavior.

**Why it fits**
- Strong fit with existing brand language
- Distinct from both GitHub and ordinary dashboard motifs
- Naturally supports SVG treatments like layers, engravings, glow edges, contour lines, and etched marks

**Potential sub-directions**
- layered alloy strip
- engraved metal plate
- heat-forged signature band
- tempered blade profile
- impact etching

#### 2. Infrastructure / circuit signature
This family treats the data as energized systems behavior: traces, nodes, pathways, current flow, switching density, structural coherence.

**Why it fits**
- Feels native to developers and engineering culture
- Supports both literal and stylized renderings
- Can encode multiple metrics elegantly through line density, branching, coherence, and illumination

**Potential sub-directions**
- energized PCB strip
- switching lattice
- trace constellation hybrid
- signal-routing board
- networked backbone

#### 3. Architectural / built structure
This is adjacent to GitCity, but can be made more premium and less toy-like by staying 2D and procedural. The data becomes a skyline, scaffold, or built strip.

**Why it fits**
- Immediately readable as "you built this"
- Strong metaphor for structure, output, and accumulation
- Good screenshot appeal

**Potential sub-directions**
- skyline band
- scaffolding strip
- modular frame
- procedural district
- compressed structure profile

#### 4. Topographic signature
The data becomes terrain, relief, contour, or geological pressure. This remains one of the strongest options because it preserves time and intensity while feeling organic and ownable.

**Why it fits**
- Strong mapping for time + accumulation + bursts
- Can be subtle and premium
- Excellent SVG feasibility

**Potential sub-directions**
- contour terrain
- pressure ridge
- relief signature
- accumulation basin
- elevation pulse

#### 5. Spectral / cinematic signal
This family includes interference bands, luminous ribbons, seismic traces, signal blooms, and scan-line fields.

**Why it fits**
- Strong visual impact in dark-mode product UI
- Supports multi-metric blending
- Feels current and high-end

**Potential sub-directions**
- interference ribbon
- spectral pulse
- aurora signal
- seismic scan
- harmonic field

#### 6. Archetype-specific metaphor system
Rather than one universal visual language, Chapa could vary the metaphor by archetype. This would match the growing appetite for persona-based summaries and identity outputs.[^26]

**Example mapping**
- Builder → structural / architectural
- Guardian → shielded field / forged alloy / defense lattice
- Marathoner → geological / endurance ribbon / strata
- Polymath → branching constellation / hybrid circuit / multifield interference

This is strategically powerful because it turns the badge from one visualization into a **family** of identity artifacts.

### Metaphor families to treat more cautiously

#### Cosmic / constellation
Beautiful and screenshot-friendly, but easier to drift into aesthetics that feel poetic rather than engineering-native.

#### Biological / organic growth
Potentially compelling, but can feel less grounded unless tightly tied to a developer-specific story.

#### Crystal / mineral growth
Visually interesting, but more speculative and potentially less legible at small sizes.

### Practical conclusion

The current opportunity is not merely to upgrade the heatmap. It is to move Chapa toward a metaphor-driven identity artifact that feels:
- personal,
- technically grounded,
- visually ownable,
- and worth sharing.

The most promising families, based on both current product pulse and longer-running literature, are:

1. **Forged artifact**
2. **Infrastructure / circuit**
3. **Architectural / built structure**
4. **Topographic signature**
5. **Spectral / cinematic signal**
6. **Archetype-specific system**

Among these, the strongest immediate design bets for Chapa are probably:
- **forged artifact** for brand coherence,
- **circuit signature** for developer-native fit,
- **topographic signature** for elegance and data fidelity,
- and **archetype-specific visual language** for product differentiation.


[^1]: Bernhard Preim, Monique Meuschke, and Veronika Weis, *A Survey of Medical Visualization Through the Lens of Metaphors* (IEEE TVCG, 2024). [PubMed](https://pubmed.ncbi.nlm.nih.gov/37934633/)
[^2]: Yvonne Jansen, Pierre Dragicevic, and Andrew Vande Moere, *Data Physicalization* (Handbook of Human Computer Interaction, 2021). [Springer](https://link.springer.com/rwe/10.1007/978-3-319-27648-9_94-1)
[^3]: Rui Xin, Tinghua Ai, and Bo Ai, *Metaphor Representation and Analysis of Non-Spatial Data in Map-Like Visualizations* (ISPRS Int. J. Geo-Inf., 2018). [MDPI](https://www.mdpi.com/2220-9964/7/6/225)
[^4]: Samuel Huron et al., *Data Physicalization* special issue overview (IEEE CG&A / Télécom Paris entry, 2020). [Institut Polytechnique de Paris](https://researchportal.ip-paris.fr/en/publications/data-physicalization/)
[^5]: Alice Thudt, Uta Hinrichs, Samuel Huron, and Sheelagh Carpendale, *Self-Reflection and Personal Physicalization Construction* (CHI, 2018). [University of Edinburgh Research Explorer](https://www.research.ed.ac.uk/en/publications/self-reflection-and-personal-physicalization-construction/)
[^6]: Eun Kyoung Choe, Bongshin Lee, Haining Zhu, Nathalie Henry Riche, and Dominikus Baur, *Understanding Self-Reflection: How People Reflect on Personal Data Through Visual Data Exploration* (Microsoft Research, 2017). [Microsoft Research](https://www.microsoft.com/en-us/research/publication/understanding-self-reflection-people-reflect/)
[^7]: Eva Hornecker, Trevor Hogan, Uta Hinrichs, and Rosa van Koningsbruggen, *A Design Vocabulary for Data Physicalization* (2023). [University of Edinburgh Research Explorer](https://www.research.ed.ac.uk/en/publications/a-design-vocabulary-for-data-physicalization/)
[^8]: Richard Wettel and Michele Lanza, *Visualizing Software Systems as Cities* (VISSOFT, 2007). [ResearchGate overview](https://www.researchgate.net/publication/221193040_Visualizing_Software_Systems_as_Cities)
[^9]: Richard Wettel and Michele Lanza, *CodeCity: 3D Visualization of Large-Scale Software* (ICSE Companion, 2008). [ResearchGate overview](https://www.researchgate.net/publication/221555855_CodeCity_3D_visualization_of_large-scale_software)
[^10]: *The influence of the city metaphor and its derivates in software visualization* (Journal of Systems and Software, 2024). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121224000281)
[^11]: Valentin Dashuber and Michael Philippsen, *Trace visualization within the Software City metaphor: Controlled experiments on program comprehension* (Information and Software Technology, 2022). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0950584922001227)
[^12]: Ivan Bacher, Brian Mac Namee, and John D. Kelleher, *The code-map metaphor: A review of its use within software visualisations* (2016 chapter). [TU Dublin Research](https://researchprofiles.tudublin.ie/en/publications/the-code-map-metaphor-a-review-of-its-use-within-software-visuali-3)
[^13]: Daniel Limberger et al., *Visual variables and configuration of software maps* (Journal of Visualization, 2023). [Springer](https://link.springer.com/article/10.1007/s12650-022-00868-1)
[^14]: *Systematic selection and implementation of graphical user interface metaphors* (Computers & Education, 2002). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0360131501000641)
[^15]: Jeffrey Heer, Nicholas Kong, and Maneesh Agrawala, *Sizing the Horizon: The Effects of Chart Size and Layering on the Graphical Perception of Time Series Visualizations* (CHI, 2009). [University of Washington PDF](https://idl.cs.washington.edu/files/2009-TimeSeries-CHI.pdf)
[^16]: Daniel Braun, Rita Borgo, Max Sondag, and Tatiana von Landesberger, *Reclaiming the Horizon: Novel Visualization Designs for Time-Series Data with Large Value Ranges* (IEEE TVCG, 2024). [PubMed](https://pubmed.ncbi.nlm.nih.gov/37871083/)
[^17]: Rita Borgo et al., *Glyph-based Visualization: Foundations, Design Guidelines, Techniques and Applications* (Eurographics STAR, 2013). [ResearchGate overview](https://www.researchgate.net/publication/235928194_Glyph-based_Visualization_Foundations_Design_Guidelines_Techniques_and_Applications)
[^18]: Nathalie Elmqvist et al., *A Systematic Review of Experimental Studies on Data Glyphs* (IEEE TVCG, 2017). [PubMed](https://pubmed.ncbi.nlm.nih.gov/27046902/)
[^19]: Evandro S. Ortigossa et al., *Time Series Information Visualization – A Review of Approaches and Tools* (IEEE Access, 2025). [ResearchGate overview](https://www.researchgate.net/publication/395457799_Time_Series_Information_Visualization_-_A_Review_of_Approaches_and_Tools)
[^20]: André van Hoorn et al., *Software landscape and application visualization for system comprehension with ExplorViz* (Information and Software Technology, 2016). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0950584916301185)
[^21]: GitCity product page. [gitcity.io](https://gitcity.io/)
[^22]: Rishabh Bhartiya, *I turned your GitHub contribution graph into a 3D city you can drive through* (DEV Community, 2026). [DEV post](https://dev.to/rishabhbhartiya/i-turned-your-github-contribution-graph-into-a-3d-city-you-can-drive-through-5acj)

[^23]: GitCity product page, describing the project as an interactive isometric 3D city generated from GitHub contributions, with driveable simulation mode, multiple themes, and embeddable SVG output. [Product Hunt](https://www.producthunt.com/products/gitcity)
[^24]: Janilson Guerreiro et al., *The influence of the city metaphor and its derivates in software visualization* (Journal of Systems and Software, 2024). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121224000281)
[^25]: Richard Wettel and Michele Lanza, *Visualizing Software Systems as Cities* (VISSOFT 2007). [ResearchGate](https://www.researchgate.net/publication/221193040_Visualizing_Software_Systems_as_Cities)
[^26]: Product Hunt, *Product Hunt Wrapped 2025* and launch discussion, as a signal for continued interest in identity-first, shareable summary artifacts. [Product Hunt](https://www.producthunt.com/products/product-hunt-wrapped-2025)
[^27]: Richard Wettel and Michele Lanza, *CodeCity: 3D visualization of large-scale software* (ICSE 2008). [ResearchGate](https://www.researchgate.net/publication/221555855_CodeCity_3D_visualization_of_large-scale_software)
[^28]: André van Hoorn et al., *ExplorViz: Research on software visualization, comprehension and collaboration* (2020). [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2665963820300257)
[^29]: Dimitris Katsis, *Audience Engagement 2025* interview, on the shift toward immersive storytelling, interactivity, and personalized experiences. [AVNetwork](https://www.avnetwork.com/news/audience-engagement-2025-jupiter-systems)

---

## 11. Discovery Session Summary (2026-04-03)

> This section documents the structured Q&A session between Juan (Chapa creator) and Claude that explored the research above and produced binding strategic decisions for the project's next evolution. The full product vision resulting from this session is captured in [docs/plans/2026-04-03-metaphor-first-badge-vision.md](../plans/2026-04-03-metaphor-first-badge-vision.md).

### 11.1 How the conversation started

The session began with the original research document (Sections 1–10 plus Addendum) as the shared artifact. The goal was to go beyond the document's recommendations and explore Juan's own vision for Chapa's future, surfacing risks, strategies, and decisions that the research alone couldn't resolve.

The conversation was structured as iterative rounds of multi-choice questions with open-ended annotation, covering: metaphor selection, ambition level, technical scope, timeline, uniqueness model, first-moment optimization, legibility philosophy, competitive moat, temporal model, cold start, public decay, complexity management, share page features, badge architecture, and next steps.

### 11.2 Key discoveries not in the original research

#### The Time Problem

The most significant insight surfaced during the session was a gap in the original research: **the document treats the badge as a snapshot of a fixed time window (90 days) but never addresses what happens to the metaphor over time.**

Juan raised the concern directly: if the metaphor represents 90 days, a peak performer can "complete" the artifact. There's nothing left to build. And since Chapa's scoring model is dynamic (scores go up AND down based on rolling activity), the metaphor would *degrade* visibly during inactivity — the "Tamagotchi trap."

This led to the two-layer temporal model (Section 11.3), which became the most architecturally significant decision of the session.

#### The Two-Layer Temporal Model

Neither the research literature surveyed nor the original document proposed this. It emerged from the Q&A:

- **Surface layer**: Current 365-day rolling scores. Honest. Rises and falls with activity.
- **Depth layer**: Lifetime MetricsSnapshot history stored in Supabase. Only grows. Never degrades.

A veteran developer on sabbatical has a deep, sleeping badge — not a degraded one. The complexity and history survive inactivity; only the surface quiets down. When they return, the surface lights up on top of rich history.

This solves all three temporal problems:
- **Ceiling**: No cap, because depth always increases over time
- **Decay**: Surface softens but depth survives — it's a rest, not a punishment
- **Engagement**: The artifact genuinely gets richer over months and years

#### Cold Start Is Data-Driven, Not Tenure-Driven

The original research implied new Chapa users would get a minimal artifact. The session clarified: **cold start is about the developer's GitHub history, not their Chapa tenure.** A senior developer signing up today already has 365 days of data. Their first badge should be strong, because their data is strong. Only genuinely new/low-activity developers start with a seed-stage artifact.

#### Indefinite Data Horizon

Juan committed to storing MetricsSnapshot data indefinitely in Supabase — building toward a decade of engineering biography. The 365-day window stays for scoring (it's the honest rolling signal), but the metaphor's depth layer and the share page's history features should use ALL available historical data, however far back it goes. This turns Supabase from a "latest state" store into a long-term engineering biography database.

### 11.3 Strategic decisions made

| Decision | Research recommendation | Session outcome | Delta |
|----------|----------------------|-----------------|-------|
| **Metaphor family** | Topographic Signature (safest balanced bet) | Archetype-specific system (ship one, branch later) | Much more ambitious; each archetype gets its own visual language over time |
| **First prototype** | Topographic Signature | Builder / Architectural Strip | Shifted to the archetype Juan can personally dogfood |
| **Temporal model** | 90-day snapshot (assumed) | Two layers: surface (365-day rolling) + depth (lifetime) | Not in the original research at all; most significant architectural addition |
| **Departure level** | Not addressed directly | Clean break from GitHub heatmap | Eliminates any evolutionary/hybrid path |
| **Decay behavior** | Not addressed | Honest reflection (badge dims during inactivity) | Bold choice for a public artifact |
| **Tenure** | Not addressed | Visually rewarded (longer history = richer artifact) | Creates a natural progression system |
| **Badge architecture** | Replace left panel entirely | Replace left panel only; keep radar + score on right | More conservative v1 scope than the document implied |
| **Share page** | Not addressed in depth | Animated timeline + history comparison; two modes (emotional + analytical) | Major product expansion beyond badge |
| **Data horizon** | Not addressed | Indefinite storage in Supabase | Strategic data asset commitment |
| **Brand alignment** | Not strongly addressed | "Forged from purpose" as anchor, not cage | Gives the visual language a tonal direction without constraining metaphor choice |
| **Legibility** | Glance legibility emphasized (Section 4 criterion) | "Intriguing, then learnable" | Trades immediate readability for curiosity-driven engagement |
| **Complexity** | 3-concept prototype sprint | "Worth the investment" — multi-quarter design system | Accepts higher cost for deeper result |
| **Competitive position** | Differentiate from GitHub heatmap | Differentiate on ALL axes vs. GitCity: analysis depth + embeddability + identity focus | Broader competitive framing |

### 11.4 How the conclusions evolved

The original research recommended a relatively conservative path: prototype three metaphor directions, pick the safest balanced option (Topographic Signature), and validate.

The session moved the vision substantially further:

1. **From "pick one metaphor" to "build a metaphor system."** The archetype-specific approach turns the badge from a single visualization into a family of identity artifacts. This is a category-defining move, not an incremental upgrade.

2. **From "snapshot" to "living artifact."** The two-layer temporal model means the badge is never static — it accumulates depth over time and reflects current state honestly. This creates an engagement loop the original research didn't address.

3. **From "chart replacement" to "identity platform."** The share page with animated timeline, history comparison, and future interactive features positions Chapa not as a badge generator but as a developer identity platform. The badge is the entry point.

4. **From "developer-facing data display" to "social artifact."** The "intriguing, then learnable" positioning and the emphasis on display value ("I want that on my profile") shift the badge's primary job from information delivery to identity expression.

### 11.5 What the original research got right

Despite the significant evolution, the core thesis of the research held up:

- **Metaphor-first is the right framing.** The session confirmed that Chapa should not be looking for "a better chart" but for "a signature object."
- **The city/architecture lineage is strong.** Builder's Architectural Strip was chosen as the v1 direction — directly descended from the research's third-ranked concept.
- **The design criteria (Section 4) remain valid.** Temporal fidelity, SVG feasibility, badge fit, brandability, metric flexibility, glance legibility, screenshot appeal, and developer resonance all featured in session decisions.
- **The "what to avoid" warnings (Section 8) are all relevant.** Especially: too many dimensions at badge scale, overly literal skeuomorphism, and losing chronology.
- **The success criteria for prototyping (Section 10) still apply.** A concept should survive if it reads as time-based activity, feels ownable, looks premium as static SVG, and is identifiable at small sizes.

### 11.6 Open questions carried forward to prototyping

These emerged during the session and are documented in the vision spec:

- Exact data mapping validation (proposed spec needs testing against real profiles)
- Small-size stress test criteria and pass/fail thresholds
- Performance budget for SVG complexity (target <50KB)
- Accessibility strategy for metaphorical visualizations
- User research plan beyond dogfooding
- How the v1 renderer should be parameterized to support future archetype branching
- What additional data (beyond current MetricsSnapshot fields) should be stored for the depth layer

# Chapa — Leave a mark

A design exploration, September 5, 2026. Local prototype; no application or deployment changes.

## The idea

Present Chapa as a developer's personal signature. The page leads with identity and the pride of making things, then explains the evidence behind the profile. The badge is treated as a collectible credential.

## Visual system

- Vermilion `#ED4930`: large identity sections, display emphasis, graphic marks.
- Ice blue `#DCEAF0`: artifact stages and verification surfaces.
- Paper `#F4F0E7`: reading surfaces and the credential.
- Ink `#1B1B19`: body copy, rules, primary actions, technical sections.
- Barlow Condensed: oversized editorial headings and archetype identities.
- Manrope: clear, compact interface and body text.
- JetBrains Mono: technical metadata, code, measurements and field labels.
- Flat color fields, thin ink rules, square actions, offset solid shadows, asymmetric compositions.

## Page story

1. Good work leaves a mark: introduce the identity with a prominent credential.
2. Code is personal: explain why commit counts are incomplete.
3. Find your type: interactive exploration of all seven archetypes.
4. Under the hood: the four core dimensions and optional Craft.
5. Made to travel: show the badge in a README and introduce the Studio.
6. Agent workflow: WebMCP exploration, co-design, and verification with human control of saving.
7. Trust and invitation: verification explained, followed by a direct closing action.

## Prototype boundaries

The original placeholder credential has been replaced with the complete `ice-terminal-v2-proposal` SVG, derived from the current `jade-v1` renderer. It remains an isolated design candidate, not a production replacement. Profiles and scores are illustrative and visibly labeled. Archetype tabs, arrow-key navigation, dimension accordions, and copying an example Markdown embed work locally. Login, Studio, methodology, archetype guides, and verification links point to the current Chapa site.

A production implementation would adapt the existing single SVG renderer, semantic token families, translations, and WebMCP registrations. This exploration does not define a second production badge implementation.

## Revision: The developer's shell

The second revision keeps the vermilion/paper/ice-blue composition and large editorial typography, while making terminal interaction part of the page's identity.

JetBrains Mono now carries the wordmark, prompts, navigation, interface actions, the MARK_ headline, and technical-section headings. The badge has a shell-style title bar. Section markers map to the command vocabulary. The first editorial version remains at `/editorial/` for comparison.

The persistent command bar supports `/` and Cmd/Ctrl+K to focus, autocomplete, arrow-key selection, Tab completion, Enter execution, Escape dismissal, and session command history on Up/Down with the suggestions closed. `/help` exposes every command with descriptions. Commands that leave the prototype are explicitly labeled as live-site navigation.

Local commands include `/home`, `/about`, `/archetypes`, every archetype's direct command, `/scoring [dimension]`, `/embed`, `/copy`, `/mcp`, `/verify`, `/whoami`, `/help`, and `/clear`. `/badge <handle>`, `/studio`, `/login`, `/terms`, and `/privacy` open their corresponding existing Chapa pages. `/whoami` identifies the local guest session and explicitly labels the profile as illustrative. No authentication, account changes, or scoring runs are simulated.

This remains a design prototype, not a new production command registry. A production implementation would retain `GlobalCommandBar` and the existing registry, adapting their presentation and deliberately introducing any new navigation commands.

## Revision: Two page themes + actual SVG badge

The site supports light, dark and system preferences through the header and `/theme [light|dark|system]`. Preferences persist locally. Dark uses charcoal `#141719`, navy stages `#192B35`, warm white `#EEEAE1`, and coral `#FF795F`; red feature sections deepen to `#3A2222` and `#A92F21`. Light retains paper, ink, vermilion and ice blue. Keyboard navigation remains active in both.

The hero and README now embed the same real SVG file. `/badge-lab` opens an interactive comparison against the unchanged current renderer. The candidate is named `ice-terminal-v2-proposal`, independently of the production `jade-v1` design lock. See `badge-lab/PROPOSAL.md` and `badge-lab/version.json` for the exact baseline and constraints.

Validation: browser review at 1440px and 390px, theme select and command persistence, dynamic four/five-axis radar including zero Craft, empty profile, effect ID isolation, 63 renderer scenarios, two real production-pipeline raster sizes (1200px/600px), and 205 passing existing badge tests. Fixtures are illustrative. No live account fetches, remote CI, deployments, or production code changes.

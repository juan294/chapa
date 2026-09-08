import { scheduleAgentSurfaceFetch } from "@/lib/analytics/schedule-server-event";

const LLMS_FULL_TXT = `# Chapa — Developer Impact Badge (Full Documentation)

> https://chapa.thecreativetoken.com

This is the extended documentation for AI models and LLM crawlers. For a concise summary, see /llms.txt.

## Overview

Chapa is a free, open web application that generates live, embeddable SVG badges showcasing a developer's impact from their development activity across linked platforms (GitHub, Bitbucket, Codeberg, GitLab). Unlike simple commit counters or streak trackers, Chapa analyzes the last 365 calendar days across four core dimensions of equal weight, and reports a separate optional report-derived Craft score beside them. Badges marked "Verified metrics" carry an HMAC-SHA256 hash showing the badge was issued by Chapa and has not been modified since; it does not establish that the underlying platform data is accurate. Badges marked "Public metrics" do not claim cryptographic attestation.

## Scoring Model: Impact v7.2

Chapa reports an **observed engineering activity and practices index** over a
declared evidence scope. It does not certify ability, causal business impact,
architecture, reliability or security. "Complete" means complete for the
connected, consented sources and the reference window named in the receipt —
never all work a person has done.

Read policyVersion on every response: v6 remains the rollout-off policy. The archived v7.1 algorithm (machine policy v7) retains its original evidence-completion range arithmetic and immutable receipts. Current v7.2 receipts use the point policy below. A missing current receipt is explicitly labelled legacy; an unavailable authoritative read is not replaced by a fabricated current score.

### The window

One reference time is captured per scoring run. The window is the reference UTC
date plus the preceding 364 UTC dates: 365 calendar dates including a partial
current day, not a trailing 8760-hour interval. Every API response, receipt,
snapshot and trend key carries that same context.

### Core dimensions (four, each weighted 0.25)

Let N(x, c) = ln(1 + min(x, c)) / ln(1 + c).

1. **Delivery** — D = 100 x N(delivery units, 120). A delivery unit is a
   distinct (project, UTC date) pair containing at least one attributable
   accepted change. Changed lines, files, PR count within the same project and
   day, tool usage and merge latency have zero effect.

2. **Quality practices** — Q = 25 x (N(rationale, 12) + N(verification, 12) +
   N(review or correction, 12) + N(outcome follow-up, 12)). These count
   demonstrated practices, not software correctness rates. A work item can
   qualify once per criterion; duplicate comments, approval clicks and reruns
   add nothing.

3. **Consistency** — C = 100 x N(active ISO weeks, 40). No weekend, burst or
   response-speed penalty, and no tenure normalization: identical evidence with
   only the account creation date changed scores identically.

4. **Breadth** — B = 50 x N(eligible projects, 4) + 50 x N(eligible categories,
   4). Stars, forks, watchers, repository concentration and changed-line
   magnitude carry zero weight.

For all coverage states, core = (D + Q + C + B) / 4. No optional Craft, solo
switch, confidence deduction or recency multiplier enters that formula. The
caps and thresholds above are published product choices, not measured
percentiles.

### Observed points and coverage

Current dimensions use the known qualifying counts with the formulas above.
Core and dimensions each publish an exact arithmetic value and a canonical
0-100 display value. Coverage bounds and missing-source descriptions remain
receipt metadata; they do not become a displayed current range or a confidence
deduction. Identical inputs under the same policy and window produce identical
scores. Caps and credits are explicit product choices, not empirical proof of
fairness across professions or evidence sources.

### Separate optional Craft

Craft = 100 x (fully + 0.7 x mostly + 0.3 x partially) / total.

The first valid Claude Code insights report unlocks the existing fifth Craft
dimension, including a score of 0. A valid scored report needs a positive total
and at least one recognized outcome count. Failed outcomes earn zero; unknown
labels and unclassified outcomes remain in the denominator with zero credit,
without being described as proven failures. Coverage is stated separately.
For example, total 10, fully 4, mostly 2, partially 1, failed 1, unknown 1 and
unclassified 1 yield 5.7 credited outcomes and Craft 57; 8 of 10 are classified.

Craft is reported beside the core and never enters it. The newest eligible
report period supplies Craft; scores are not pooled and the highest score is
not selected. Replacing the same period requires an explicit correction.
Older or insufficient uploads do not replace a still-valid scored report.
Expiry retains the unlocked Craft label with update guidance and no fabricated
zero or current point. Raw reports and unknown labels remain private; public
receipts contain the numeric aggregates needed to replay the calculation.
Report Craft does not assess personal engineering ability or assign Artificer.

### Receipts

Each scored revision issues an immutable public receipt containing every
aggregate, coverage bound and report outcome credit needed to replay the arithmetic
offline. It excludes private paths, repository names, report contents, tokens
and evaluator identities. Public replay validates arithmetic over the issued
aggregates; it does not establish private-source truth.

### Tiers

- **Emerging**: unrounded core below 30.
- **Solid**: unrounded core from 30 to below 70.
- **High**: unrounded core from 70 to below 85.
- **Elite**: unrounded core from 85 through 100.

Display normally rounds to the nearest integer, but never crosses the exact
score's tier boundary. For example, an exact 69.99723619005769 displays 69.99
with Solid. Consumers use this canonical display and retain exact arithmetic
separately rather than rounding it again.

### Developer Archetypes

Existing archetype names and core classification rules are retained. A definitive core archetype is assigned only when normalized coverage endpoints agree; otherwise archetype is null. The existing guide names are:

- **Builder**: Dominant in Delivery. Ships features, closes issues, high PR merge rate. The quintessential feature developer.
- **Quality Champion**: Dominant in Quality. Reviews code rigorously, provides thorough feedback. The team's quality gatekeeper.
- **Marathoner**: Dominant in Consistency. Shows up reliably week after week. Steady, dependable contributor.
- **Polymath**: Dominant in Breadth. Works across many repos, orgs, and project boundaries. A cross-team collaborator.
- **Artificer**: An existing guide and historical label. Current report-derived Craft does not assign this label.
- **Balanced**: No single dominant dimension — all are closely matched and collectively strong. A versatile, well-rounded contributor.
- **Emerging**: Low overall activity or new to contribution. The starting point for developers building their profile.

Each archetype has a dedicated guide page at /archetypes/{type} explaining the traits, signals, and what the archetype means in practice.

## Badge Features

- **Live SVG**: Rendered server-side, embeddable anywhere that supports images (GitHub README, portfolio sites, LinkedIn, resumes).
- **Activity Timeline**: Dot-based daily contribution visualization showing activity distribution.
- **Radar Chart**: Dynamic radar visualization — five dimensions after Craft unlocks, including a valid zero; four core dimensions before unlock. An expired Craft point is omitted while its unlocked label remains.
- **Score and Tier**: Prominent canonical core point with its unrounded tier. Coverage limitations are explained separately.
- **Archetype Label**: Primary archetype classification.
- **Creator Studio**: Visual customization tool at /studio with 7 categories (background, card style, border, score effect, heatmap animation, tier treatment, color palette), every one of which renders in the embeddable badge.

## Agent Tools (WebMCP)

Chapa registers browser-native WebMCP tools through \`document.modelContext\`. Tool registration happens when client JavaScript loads on the named page. A preview hello-world registration was verified in flagged Google Chrome 151; the completed catalog still needs final production verification. ChatGPT compatibility has not been tested.

### Landing page: \`/\`

- \`get_site_capabilities\` (read-only): Describes Chapa, its page-scoped tool map, entry points, and human-action boundaries.
- \`find_profile\` (read-only): Validates a public GitHub handle and returns canonical share-page and badge URLs without making a request; public profile tools require the owner to have signed in.

### Creator Studio: \`/studio\` and \`/studio?demo=1\`

Demo mode at \`/studio?demo=1\` needs no login and uses fixed local data. Tools can change visible page state, but saving always requires a human click on the confirmation control.

- \`list_style_options\` (read-only): Returns every style category, option, preset, and the current badge configuration.
- \`apply_badge_style\` (changes page state): Runs the visible \`/set <category> <value>\` command and returns the resulting configuration.
- \`apply_preset\` (changes page state): Runs the visible \`/preset <name>\` command and returns the resulting configuration.
- \`preview_badge\` (read-only): Returns the current configuration, public badge SVG URL, and save status.
- \`reset_badge_config\` (changes page state): Runs the visible \`/reset\` command and returns the reset configuration.
- \`save_badge_config\` (human-gated): Opens an on-page save proposal but never calls the save API itself.
- \`simulate_score\` (read-only): Replays supplied count scenarios under the current receipt policy and window without saving data. Direct dimension overrides are explicitly hypothetical, use the four core weights, and cannot add Craft to the core.
- \`suggest_improvements\` (read-only): Returns grounded improvement suggestions from the current impact profile.
- \`explain_dimension\` (read-only): Returns the selected receipt point and its recorded calculation; legacy submetrics are not presented as current arithmetic.

### Public profile: \`/u/{handle}\`

- \`get_impact_profile\` (read-only): Returns the redacted public impact, key stats, verification summary, trend, diff, and freshness.
- \`get_impact_history\` (read-only): Fetches public snapshots and trend data with friendly missing-data and rate-limit messages.
- \`verify_badge\` (read-only): Returns the public verification record and verification URL when the profile has a hash.
- \`explain_dimension\` (read-only): Explains a dimension using the current public page data.
- \`compare_profiles\` (read-only): Compares compatible public profiles under the same policy and window; mixed policies or incompatible windows return not_comparable without numeric deltas.
- \`get_embed_snippet\` (read-only): Returns canonical Markdown and HTML snippets for the live badge.

### Verification page: \`/verify/{hash}\`

- \`get_verification_record\` (read-only): Returns the hash and public verification record already displayed on the page.
- \`explain_verification\` (read-only): Explains what HMAC-SHA256 verification proves, what it does not prove, expiry, and code format.

Machine-readable catalog: https://chapa.thecreativetoken.com/.well-known/mcp.json

Remote MCP endpoint: https://chapa.thecreativetoken.com/api/mcp — stateless Streamable HTTP with the same 9 public read-only tools as their browser WebMCP twins.

## API Endpoints

### Public (no auth required)
- \`GET /u/{handle}/badge.svg\` — Embeddable badge image. Returns SVG with policy-aware Cache-Control headers, bounded to at most five minutes and the current UTC date; unavailable or changing authority responses are not cached.
- \`GET /u/{handle}\` — Share page with badge, breakdown, and embed snippets.
- \`GET /api/profile/{handle}\` — JSON: policyVersion, receipt identity and window, canonical displayScore, exactScore, dimensions, tier, nullable archetype and separate Craft. Current compositeScore and adjustedComposite aliases agree with displayScore; they do not expose a competing EMA headline. Historical v6 fields, when supplied, are explicitly nested under legacy. Report-derived Craft is read from the published receipt, not a pending upload.
- \`GET /api/history/{handle}\` — JSON: policy-qualified immutable observations and durable trend anchors. EMA is a separate trend value, never the badge score. Policy changes or incompatible windows do not produce a comparable score delta.
- \`GET /about/scoring\` — Scoring methodology page.
- \`GET /archetypes/{type}\` — Archetype guide (builder, guardian, marathoner, polymath, artificer, balanced, emerging).

### Authenticated
- \`GET /studio\` — Creator Studio (requires GitHub OAuth).
- \`POST /api/refresh?handle={handle}\` — Force badge refresh (rate-limited).

## Embedding

Markdown:
\`\`\`
![Chapa Badge](https://chapa.thecreativetoken.com/u/{handle}/badge.svg)
\`\`\`

HTML:
\`\`\`
<img src="https://chapa.thecreativetoken.com/u/{handle}/badge.svg" alt="Chapa Impact Badge" width="600" height="315" />
\`\`\`

## Technology

Built with Next.js (App Router), TypeScript, Tailwind CSS, Upstash Redis for caching, Supabase for user data, and PostHog for analytics. Badge SVGs are rendered server-side using React-to-SVG templating.

## Data & Privacy

- Only public data from linked platforms is analyzed. No private repository access.
- Scores cached 24 hours, then recomputed from fresh data.
- No personal data is sold. Processing providers are Vercel, Upstash Redis, Supabase, Resend, and PostHog; details and purposes: https://chapa.thecreativetoken.com/privacy
- Full privacy policy: https://chapa.thecreativetoken.com/privacy
- Terms of service: https://chapa.thecreativetoken.com/terms

## Related Topics

developer metrics, multi-platform developer badge, developer impact score, GitHub profile badge, Bitbucket developer metrics, Codeberg developer metrics, GitLab developer metrics, developer portfolio badge, developer stats SVG, open source contribution metrics, code review metrics, developer archetype classification, developer activity analysis, developer impact measurement, engineering metrics, developer productivity tools, README badges, contribution visualization.

## Contact

- Website: https://chapa.thecreativetoken.com
- Email: support@chapa.thecreativetoken.com
- Twitter/X: @chapabadge
`;

export function GET(request: Request): Response {
  scheduleAgentSurfaceFetch(request, "llms-full.txt");
  return new Response(LLMS_FULL_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}

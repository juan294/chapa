import { scheduleAgentSurfaceFetch } from "@/lib/analytics/schedule-server-event";

const LLMS_FULL_TXT = `# Chapa — Developer Impact Badge (Full Documentation)

> https://chapa.thecreativetoken.com

This is the extended documentation for AI models and LLM crawlers. For a concise summary, see /llms.txt.

## Overview

Chapa is a free, open web application that generates live, embeddable SVG badges showcasing a developer's impact from their development activity across linked platforms (GitHub, Bitbucket, Codeberg, GitLab). Unlike simple commit counters or streak trackers, Chapa analyzes the last 365 calendar days across four core dimensions of equal weight, and reports a separate optional Craft practice portfolio beside them. Badges marked "Verified metrics" carry an HMAC-SHA256 hash showing the badge was issued by Chapa and has not been modified since; it does not establish that the underlying platform data is accurate. Badges marked "Public metrics" do not claim cryptographic attestation.

## Scoring Model: Impact v7

Chapa reports an **observed engineering activity and practices index** over a
declared evidence scope. It does not certify ability, causal business impact,
architecture, reliability or security. "Complete" means complete for the
connected, consented sources and the reference window named in the receipt —
never all work a person has done.

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

For complete evidence, core = (D + Q + C + B) / 4. No optional Craft, solo
switch, confidence deduction or recency multiplier enters that formula. The
caps and thresholds above are published product choices, not measured
percentiles.

### Evidence-completion ranges

Where coverage is incomplete, each count carries a lower bound from known
observations and an upper bound from the completions the recorded coverage
allows. The published interval contains every admissible completion. It is an
evidence-completion range, not a statistical confidence interval, and it does
not imply a developer's true ability lies within it. A range receives a tier
only if the whole interval sits inside one tier; a non-point dimension set
receives no definitive archetype.

### Separate optional Craft

K = 25 x (N(framing, 8) + N(verification/debugging, 8) + N(tool judgment, 8) +
N(accepted outcome, 8)), over deduplicated work-item episodes assessed against
the published rubric by an accountable reviewer.

Craft is reported beside the core and never enters it. An absent, expired or
withdrawn portfolio changes Craft alone. Tool name, tokens, lines, files,
message counts, agent counts, parallel usage and reply speed receive zero
automatic credit; choosing not to use or to constrain a tool demonstrates
judgment the same way using one does, and a developer who uses no AI tool can
submit a full practice portfolio. An optional Artificer descriptor requires a
complete Craft point of at least 60 and at least one independently corroborated
episode satisfying all four criteria.

### Receipts

Each scored revision issues an immutable public receipt containing every
aggregate, coverage bound and rubric result needed to replay the arithmetic
offline. It excludes private paths, repository names, report contents, tokens
and evaluator identities. Public replay validates arithmetic over the issued
aggregates; it does not establish private-source truth.

### Tiers

- **Emerging** (0-29): Early-stage or occasional contributor.
- **Solid** (30-69): Regular, meaningful contributor.
- **High** (70-84): Significant impact across multiple dimensions.
- **Elite** (85-100): Exceptional impact — top-tier contributor.

### Developer Archetypes

Based on the shape of the dimension radar chart, each developer is assigned one of seven archetypes:

- **Builder**: Dominant in Delivery. Ships features, closes issues, high PR merge rate. The quintessential feature developer.
- **Quality Champion**: Dominant in Quality. Reviews code rigorously, provides thorough feedback. The team's quality gatekeeper.
- **Marathoner**: Dominant in Consistency. Shows up reliably week after week. Steady, dependable contributor.
- **Polymath**: Dominant in Breadth. Works across many repos, orgs, and project boundaries. A cross-team collaborator.
- **Artificer**: An optional Craft descriptor, not a core archetype. Requires a complete Craft point of at least 60 and at least one independently corroborated episode satisfying all four practice criteria, including an accepted outcome.
- **Balanced**: No single dominant dimension — all are closely matched and collectively strong. A versatile, well-rounded contributor.
- **Emerging**: Low overall activity or new to contribution. The starting point for developers building their profile.

Each archetype has a dedicated guide page at /archetypes/{type} explaining the traits, signals, and what the archetype means in practice.

## Badge Features

- **Live SVG**: Rendered server-side, embeddable anywhere that supports images (GitHub README, portfolio sites, LinkedIn, resumes).
- **Activity Timeline**: Dot-based daily contribution visualization showing activity distribution.
- **Radar Chart**: Dynamic radar visualization — five-point pentagon when Craft data exists, four-point diamond otherwise.
- **Score and Tier**: Prominent core score with tier badge. Where source coverage is incomplete the score is published as an interval, and an interval spanning a tier boundary carries no tier.
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
- \`simulate_score\` (read-only): Calculates a score from supplied dimensions without saving data.
- \`suggest_improvements\` (read-only): Returns grounded improvement suggestions from the current impact profile.
- \`explain_dimension\` (read-only): Returns the selected score, formula, tip, and normalized submetrics.

### Public profile: \`/u/{handle}\`

- \`get_impact_profile\` (read-only): Returns the redacted public impact, key stats, verification summary, trend, diff, and freshness.
- \`get_impact_history\` (read-only): Fetches public snapshots and trend data with friendly missing-data and rate-limit messages.
- \`verify_badge\` (read-only): Returns the public verification record and verification URL when the profile has a hash.
- \`explain_dimension\` (read-only): Explains a dimension using the current public page data.
- \`compare_profiles\` (read-only): Compares the on-page profile with another existing public Chapa profile and returns score and dimension differences.
- \`get_embed_snippet\` (read-only): Returns canonical Markdown and HTML snippets for the live badge.

### Verification page: \`/verify/{hash}\`

- \`get_verification_record\` (read-only): Returns the hash and public verification record already displayed on the page.
- \`explain_verification\` (read-only): Explains what HMAC-SHA256 verification proves, what it does not prove, expiry, and code format.

Machine-readable catalog: https://chapa.thecreativetoken.com/.well-known/mcp.json

Remote MCP endpoint: https://chapa.thecreativetoken.com/api/mcp — stateless Streamable HTTP with the same 9 public read-only tools as their browser WebMCP twins.

## API Endpoints

### Public (no auth required)
- \`GET /u/{handle}/badge.svg\` — Embeddable badge image. Returns SVG with Cache-Control headers (6h s-maxage, 7d stale-while-revalidate).
- \`GET /u/{handle}\` — Share page with badge, breakdown, and embed snippets.
- \`GET /api/profile/{handle}\` — JSON: impact dimensions, archetype, tier, and optional craft score. Two headline pairs, deliberately distinct: \`displayScore\`/\`displayTier\` are the FRESH values shown on the badge and share page, while \`compositeScore\`/\`adjustedComposite\`/\`tier\` come from the persisted daily snapshot and are EMA-smoothed for the trend sparkline. Use \`displayScore\` to match the badge; use \`adjustedComposite\` to plot history. \`displayScore\` is null when the fresh score cannot be computed AND when the score is an evidence-completion range, because a range has no single number an external consumer could republish as exact — read \`scoring\` on the same response for the interval and its bounds.
- \`GET /api/history/{handle}\` — JSON: score history, trend (improving/stable/declining), and snapshot diffs.
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

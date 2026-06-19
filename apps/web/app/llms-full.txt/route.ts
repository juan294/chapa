const LLMS_FULL_TXT = `# Chapa — Developer Impact Badge (Full Documentation)

> https://chapa.thecreativetoken.com

This is the extended documentation for AI models and LLM crawlers. For a concise summary, see /llms.txt.

## Overview

Chapa is a free, open web application that generates live, embeddable SVG badges showcasing a developer's impact from their development activity across linked platforms (GitHub, Bitbucket, Codeberg, GitLab). Unlike simple commit counters or streak trackers, Chapa analyzes 12 months of data across four core dimensions — plus an optional fifth Craft dimension — to produce a nuanced developer impact profile. Each badge includes a cryptographic verification hash (HMAC-SHA256) proving the data hasn't been tampered with.

## Scoring Model: Impact v6

### Core Dimensions (each scored 0-100)

1. **Delivery** — Measures shipping capability. Inputs: pull requests merged, issues closed, commit frequency. A ±5% flow efficiency modifier rewards fast PR turnaround (median creation-to-merge time). A high Delivery score indicates a developer who consistently ships meaningful changes.

2. **Quality** — Measures engineering discipline. For collaborative developers (review-to-PR ratio ≥ 15%), inputs are code reviews submitted and review-to-PR ratio. For solo developers (ratio < 15%), inputs are PR description rate, feature branch usage, issue linkage, and batch size score (fraction of PRs in the 20-500 line reviewable sweet spot). A high Quality score indicates someone who actively maintains engineering standards.

3. **Consistency** — Measures sustained contribution over time. Inputs: active days (sqrt curve), heatmap evenness (weekly distribution with outlier clipping), and week coverage (fraction of weeks with any activity). A high Consistency score means reliable, regular contributions across weeks.

4. **Breadth** — Measures cross-project influence. Inputs: number of distinct repositories contributed to, diversity of organizations, contributions outside owned repos. A high Breadth score indicates influence across multiple projects and teams.

### Optional Fifth Dimension

5. **Craft** — Measures AI tool collaboration patterns. Computed from Claude Code usage insights when a developer imports their usage report. A high Craft score indicates deliberate, effective human-AI partnership.

### Composite Score

The composite score (0-100) is the average of all dimensions (4 or 5). It is further adjusted by confidence to produce an adjusted score. The adjusted score determines the tier.

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
- **Artificer**: Dominant in Craft. Master of AI tool collaboration, amplifies output while maintaining quality through deliberate human-AI partnership.
- **Balanced**: No single dominant dimension — all are closely matched and collectively strong. A versatile, well-rounded contributor.
- **Emerging**: Low overall activity or new to contribution. The starting point for developers building their profile.

Each archetype has a dedicated guide page at /archetypes/{type} explaining the traits, signals, and what the archetype means in practice.

## Badge Features

- **Live SVG**: Rendered server-side, embeddable anywhere that supports images (GitHub README, portfolio sites, LinkedIn, resumes).
- **Activity Timeline**: Dot-based daily contribution visualization showing activity distribution.
- **Radar Chart**: Dynamic radar visualization — five-point pentagon when Craft data exists, four-point diamond otherwise.
- **Score and Tier**: Prominent adjusted score with tier badge.
- **Archetype Label**: Primary archetype classification.
- **Creator Studio**: Visual customization tool at /studio with 9 categories (background, card style, border, score effect, heatmap animation, interaction, stats display, tier treatment, celebration).

## API Endpoints

### Public (no auth required)
- \`GET /u/{handle}/badge.svg\` — Embeddable badge image. Returns SVG with Cache-Control headers (6h s-maxage, 7d stale-while-revalidate).
- \`GET /u/{handle}\` — Share page with badge, breakdown, and embed snippets.
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
- No personal data sold or shared with third parties.
- Full privacy policy: https://chapa.thecreativetoken.com/privacy
- Terms of service: https://chapa.thecreativetoken.com/terms

## Related Topics

developer metrics, multi-platform developer badge, developer impact score, GitHub profile badge, Bitbucket developer metrics, Codeberg developer metrics, GitLab developer metrics, developer portfolio badge, developer stats SVG, open source contribution metrics, code review metrics, developer archetype classification, developer activity analysis, developer impact measurement, engineering metrics, developer productivity tools, README badges, contribution visualization.

## Contact

- Website: https://chapa.thecreativetoken.com
- Email: support@chapa.thecreativetoken.com
- Twitter/X: @chapabadge
`;

export function GET(): Response {
  return new Response(LLMS_FULL_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}

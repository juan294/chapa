const LLMS_FULL_TXT = `# Chapa — Developer Impact Badge (Full Documentation)

> https://chapa.thecreativetoken.com

This is the extended documentation for AI models and LLM crawlers. For a concise summary, see /llms.txt.

## Overview

Chapa is a free, open web application that generates live, embeddable SVG badges showcasing a developer's impact from their GitHub activity. Unlike simple commit counters or streak trackers, Chapa analyzes 12 months of GitHub data across four independent dimensions to produce a nuanced developer impact profile. Each badge includes a cryptographic verification hash (HMAC-SHA256) proving the data hasn't been tampered with.

## Scoring Model: Impact v4

### Four Dimensions (each scored 0-100)

1. **Building** — Measures shipping capability. Inputs: pull requests merged, issues closed, commit frequency to non-fork repos. A high Building score indicates a developer who consistently ships meaningful changes.

2. **Guarding** — Measures code review and quality gatekeeping. Inputs: pull request reviews given, review comments, approval/change-request ratio. A high Guarding score indicates someone who actively improves code quality through reviews.

3. **Consistency** — Measures sustained contribution over time. Inputs: active weeks (out of 52), contribution distribution across months, absence of long gaps. A high Consistency score means reliable, steady contributions rather than sporadic bursts.

4. **Breadth** — Measures cross-project influence. Inputs: number of distinct repositories contributed to, diversity of organizations, contributions outside owned repos. A high Breadth score indicates influence across multiple projects and teams.

### Composite Score

The composite score (0-100) is a weighted combination of the four dimensions. It is further adjusted by confidence to produce an adjusted score. The adjusted score determines the tier.

### Tiers

- **Emerging** (0-39): Early-stage or occasional contributor.
- **Solid** (40-69): Regular, meaningful contributor.
- **High** (70-84): Significant impact across multiple dimensions.
- **Elite** (85-100): Exceptional impact — top-tier contributor.

### Developer Archetypes

Based on the shape of the four-dimension radar chart, each developer is assigned an archetype:

- **Builder**: Dominant in Building. Ships features, closes issues, high PR merge rate. The quintessential feature developer.
- **Guardian**: Dominant in Guarding. Reviews code rigorously, provides thorough feedback. The team's quality gatekeeper.
- **Marathoner**: Dominant in Consistency. Shows up reliably week after week. Steady, dependable contributor.
- **Polymath**: Dominant in Breadth. Works across many repos, orgs, and project boundaries. A cross-team collaborator.
- **Balanced**: No single dominant dimension — all four are closely matched and collectively strong. A versatile, well-rounded contributor.
- **Emerging**: Low overall activity or new to contribution. The starting point for developers building their profile.

Each archetype has a dedicated guide page at /archetypes/{type} explaining the traits, signals, and what the archetype means in practice.

## Badge Features

- **Live SVG**: Rendered server-side, embeddable anywhere that supports images (GitHub README, portfolio sites, LinkedIn, resumes).
- **Heatmap**: 52-week contribution heatmap showing activity distribution.
- **Radar Chart**: Four-axis radar visualization of the dimension profile.
- **Score and Tier**: Prominent adjusted score with tier badge.
- **Archetype Label**: Primary archetype classification.
- **Creator Studio**: Visual customization tool at /studio with 9 categories (background, card style, border, score effect, heatmap animation, interaction, stats display, tier treatment, celebration).

## API Endpoints

### Public (no auth required)
- \`GET /u/{handle}/badge.svg\` — Embeddable badge image. Returns SVG with Cache-Control headers (6h s-maxage, 7d stale-while-revalidate).
- \`GET /u/{handle}\` — Share page with badge, breakdown, and embed snippets.
- \`GET /api/history/{handle}\` — JSON: score history, trend (improving/stable/declining), and snapshot diffs.
- \`GET /about/scoring\` — Scoring methodology page.
- \`GET /archetypes/{type}\` — Archetype guide (builder, guardian, marathoner, polymath, balanced, emerging).

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
<img src="https://chapa.thecreativetoken.com/u/{handle}/badge.svg" alt="Chapa Impact Badge" width="600" />
\`\`\`

## Technology

Built with Next.js (App Router), TypeScript, Tailwind CSS, Upstash Redis for caching, Supabase for user data, and PostHog for analytics. Badge SVGs are rendered server-side using React-to-SVG templating.

## Data & Privacy

- Only public GitHub data is analyzed. No private repository access.
- Scores cached 24 hours, then recomputed from fresh data.
- No personal data sold or shared with third parties.
- Full privacy policy: https://chapa.thecreativetoken.com/privacy
- Terms of service: https://chapa.thecreativetoken.com/terms

## Related Topics

GitHub developer metrics, GitHub contribution analytics, developer impact score, GitHub profile badge, developer portfolio badge, GitHub stats SVG, open source contribution metrics, code review metrics, developer archetype classification, GitHub activity analysis, developer impact measurement, engineering metrics, developer productivity tools, GitHub README badges, contribution visualization.

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
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

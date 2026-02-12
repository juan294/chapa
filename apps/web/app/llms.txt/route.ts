const LLMS_TXT = `# Chapa — Developer Impact Badge

> https://chapa.thecreativetoken.com

## What is Chapa?

Chapa is a developer tool that generates a live, embeddable SVG badge showcasing a developer's Impact Score from their GitHub activity. It analyzes the last 12 months of commits, pull requests, code reviews, and issues to produce a transparent, data-driven impact rating.

## Key Concepts

- **Impact Score v3**: A composite score (0-100) based on commits, PRs merged, code reviews, and issues from the last 12 months of GitHub activity.
- **Confidence Rating**: A quality signal (50-100) that surfaces data patterns without making accusations. Higher confidence means more consistent, diverse activity.
- **Tier System**: Four tiers based on adjusted score — Newcomer, Rising, Established, and Elite.

## Endpoints

- \`GET /\` — Landing page with GitHub OAuth login.
- \`GET /u/{handle}\` — Share page showing a developer's badge, impact breakdown, confidence reasons, and embed snippets.
- \`GET /u/{handle}/badge.svg\` — Embeddable SVG badge image. Public, no auth required. Cached for 24 hours.

## How to Use

1. Sign in with GitHub at https://chapa.thecreativetoken.com
2. Chapa computes your Impact Score v3 from public GitHub data.
3. Embed the badge in your README, portfolio, or resume:

Markdown:
\`\`\`
![Chapa Badge](https://chapa.thecreativetoken.com/u/{handle}/badge.svg)
\`\`\`

HTML:
\`\`\`
<img src="https://chapa.thecreativetoken.com/u/{handle}/badge.svg" alt="Chapa Impact Badge" width="600" />
\`\`\`

## Target Audience

Software developers who want to showcase their GitHub contributions with a verified, data-driven impact badge.

## Data & Privacy

- Only public GitHub data is accessed (no private repos).
- Scores are cached for 24 hours, then recomputed.
- No personal data is sold or shared with third parties.
- Privacy policy: https://chapa.thecreativetoken.com/privacy

## Contact

- Website: https://chapa.thecreativetoken.com
- Email: support@chapa.thecreativetoken.com
`;

export function GET(): Response {
  return new Response(LLMS_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

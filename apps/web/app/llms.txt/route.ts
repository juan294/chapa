import { scheduleAgentSurfaceFetch } from "@/lib/analytics/schedule-server-event";

const LLMS_TXT = `# Chapa — Developer Impact Badge

> https://chapa.thecreativetoken.com

## What is Chapa?

Chapa is a free developer tool that generates a live, embeddable SVG badge showcasing a developer's Impact Score from their development activity across linked platforms (GitHub, Bitbucket, Codeberg, GitLab). It analyzes the last 12 months of commits, pull requests, code reviews, and issues to produce a transparent, data-driven developer impact rating. Think of it as a developer stats badge that goes beyond commit counts.

For full technical details, see: https://chapa.thecreativetoken.com/llms-full.txt

## Key Concepts

- **Impact Profile**: An observed engineering activity and practices index (0-100) over four core dimensions of equal weight — Delivery, Quality practices, Consistency, and Breadth — computed from the last 365 calendar days of development activity across linked platforms, within a declared evidence scope. It is not a measure of ability, and complete means complete for that declared scope, not all work a person has done. A separate optional Craft practice portfolio is reported beside it and never changes the core.
- **Dimensions**: Delivery counts distinct project/day buckets containing accepted work. Quality practices counts demonstrated rationale, verification, review-or-correction and outcome follow-up. Consistency counts active ISO weeks. Breadth counts eligible projects and eligible work categories. Craft (optional, separate) records assessed engineering practice: framing, verification and debugging, tool judgment, and accepted outcome. Tool name, token counts, message counts and session counts earn no credit anywhere.
- **Developer Archetypes**: Based on dimension shape, developers are classified as Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, or Emerging. Each archetype reflects a distinct contribution pattern.
- **Tier System**: Four tiers, classified from the unrounded core score — Emerging (below 30), Solid (below 70), High (below 85), Elite (85 and above). A range spanning a boundary receives no tier.
- **Evidence completion ranges**: Where source coverage is incomplete, a dimension is published as a range whose bounds contain every admissible completion. This is an evidence-completion range, not a statistical confidence interval, and it says nothing about where a developer's true ability lies. A range that spans a tier boundary receives no tier.
- **Badge Verification**: Badges marked "Verified metrics" carry an HMAC-SHA256 hash showing the badge was issued by Chapa and has not been modified since. It does not establish that the underlying platform data is accurate; public replay validates arithmetic over the issued aggregates, not private-source truth. Badges marked "Public metrics" make no cryptographic claim.

## Endpoints

- \`GET /\` — Landing page with GitHub OAuth login.
- \`GET /u/{handle}\` — Share page with badge preview, impact breakdown, and embed snippets.
- \`GET /u/{handle}/badge.svg\` — Embeddable SVG badge image. Public, no auth required. Cached.
- \`GET /about/scoring\` — Full scoring methodology documentation.
- \`GET /archetypes/{type}\` — Archetype guide pages (builder, guardian, marathoner, polymath, artificer, balanced, emerging).
- \`GET /api/history/{handle}\` — Score history, trend analysis, and snapshot diffs. Public, rate-limited.
- \`GET /studio\` — Creator Studio for badge visual customization.

## Agent Tools (WebMCP)

Chapa registers browser-native WebMCP tools through \`document.modelContext\` on 4 pages. An agent driving a WebMCP-capable browser can operate the site directly. There are 18 distinct tools across these pages:

- \`/\`: \`get_site_capabilities\`, \`find_profile\`
- \`/studio\` and \`/studio?demo=1\` (no login in demo mode): \`list_style_options\`, \`apply_badge_style\`, \`apply_preset\`, \`preview_badge\`, \`reset_badge_config\`, \`save_badge_config\`, \`simulate_score\`, \`suggest_improvements\`, \`explain_dimension\`
- \`/u/{handle}\`: \`get_impact_profile\`, \`get_impact_history\`, \`verify_badge\`, \`explain_dimension\`, \`compare_profiles\`, \`get_embed_snippet\`
- \`/verify/{hash}\`: \`get_verification_record\`, \`explain_verification\`

Tool registration happens at page load in client JavaScript. Full catalog: https://chapa.thecreativetoken.com/llms-full.txt

Machine-readable catalog: https://chapa.thecreativetoken.com/.well-known/mcp.json

Remote MCP endpoint: https://chapa.thecreativetoken.com/api/mcp — stateless Streamable HTTP with the same 9 public read-only tools as their WebMCP twins.

## How to Use

1. Sign in with GitHub at https://chapa.thecreativetoken.com
2. Chapa computes your Impact v6 Profile from public platform data (GitHub, Bitbucket, Codeberg, GitLab).
3. Embed the badge in your README, portfolio, resume, or LinkedIn:

Markdown:
\`\`\`
![Chapa Badge](https://chapa.thecreativetoken.com/u/{handle}/badge.svg)
\`\`\`

HTML:
\`\`\`
<img src="https://chapa.thecreativetoken.com/u/{handle}/badge.svg" alt="Chapa Impact Badge" width="600" height="315" />
\`\`\`

## Related Keywords

developer metrics, multi-platform developer badge, developer impact score, GitHub profile badge, Bitbucket developer metrics, Codeberg developer metrics, GitLab developer metrics, developer portfolio badge, developer stats SVG, open source contribution metrics, code review metrics, developer archetype, developer activity analysis, developer impact measurement.

## Target Audience

Software developers, open source contributors, and engineering teams who want to showcase and understand their development contributions with a verified, data-driven impact badge.

## Data & Privacy

- Only public data from linked platforms is accessed (no private repos).
- Scores are cached for 24 hours, then recomputed.
- No personal data is sold. Processing providers are Vercel, Upstash Redis, Supabase, Resend, and PostHog; details and purposes: https://chapa.thecreativetoken.com/privacy
- Privacy policy: https://chapa.thecreativetoken.com/privacy

## Contact

- Website: https://chapa.thecreativetoken.com
- Email: support@chapa.thecreativetoken.com
- Twitter/X: @chapabadge
`;

export function GET(request: Request): Response {
  scheduleAgentSurfaceFetch(request, "llms.txt");
  return new Response(LLMS_TXT, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}

import { scheduleAgentSurfaceFetch } from "@/lib/analytics/schedule-server-event";

const LLMS_TXT = `# Chapa — Developer Impact Badge

> https://chapa.thecreativetoken.com

## What is Chapa?

Chapa is a free developer tool that generates a live, embeddable SVG badge showcasing a developer's Impact Score from their development activity across linked platforms (GitHub, Bitbucket, Codeberg, GitLab). It analyzes the last 12 months of commits, pull requests, code reviews, and issues to produce a transparent, data-driven developer impact rating. Think of it as a developer stats badge that goes beyond commit counts.

For full technical details, see: https://chapa.thecreativetoken.com/llms-full.txt

## Key Concepts

- **Policy identity**: Read the response's policyVersion. v6 remains the rollout-off policy; v7.2 is the new point policy when enabled and a receipt is available. The archived v7.1 algorithm (machine policy v7) retains its historical evidence-completion ranges and can still be replayed; it is not the current point policy.
- **Impact Profile**: v7.2 reports an observed engineering activity and practices index (0-100) over four equally weighted core dimensions — Delivery, Quality, Consistency, and Breadth — from the declared 365-calendar-date window. It measures recorded evidence, not personal ability. Coverage limits remain visible without replacing the current point with a range.
- **Dimensions**: Delivery counts distinct project/day buckets containing accepted work. Quality counts demonstrated rationale, verification, review-or-correction and outcome follow-up. Consistency counts active ISO weeks. Breadth counts eligible projects and work categories. Each core dimension has weight 0.25.
- **Craft**: A separate report-derived dimension, unlocked on the badge after the first valid Claude Code insights report, including a score of 0. Craft = 100 x (fully + 0.7 x mostly + 0.3 x partially) / total. Failed, unknown and unclassified outcomes earn no credit; unknown outcomes are not proven failures. Craft has zero core weight. Expiry retains the unlocked label with update guidance, never a fabricated zero.
- **Developer Archetypes**: Existing names remain Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, and Emerging. Current classification uses the existing core rules only when the evidence supports a definitive shape; otherwise it is null. A report does not assign Artificer.
- **Tier System**: Emerging below 30, Solid below 70, High below 85, Elite from 85, using the unrounded core. The canonical display avoids crossing a tier boundary: for example, an exact value just below 70 displays 69.99 with Solid. All public consumers use the receipt's canonical value; exact arithmetic is supplied separately.
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
2. Chapa computes your profile under the selected policy from public platform data (GitHub, Bitbucket, Codeberg, GitLab). The response and receipt identify that policy.
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

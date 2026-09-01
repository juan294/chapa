# Phase 6: ChatGPT app submission pack (#1260)

Branch: `feature/1260-chatgpt-app-pack`
Depends on: phase 4 (the MCP endpoint is what gets submitted).

All requirements below were verified against
developers.openai.com/apps-sdk/app-submission-guidelines and
/plugins/deploy/submission on 2026-09-01. Chapa's position is strong:
read-only tools, no auth, no demo credentials needed, `/privacy` and
`support@chapa.thecreativetoken.com` already exist.

## Step 1 (tests first): domain verification route

New `apps/web/app/.well-known/openai-apps-challenge/route.ts` + test:

```ts
const token = getOpenaiAppsChallengeToken();   // new lib/env.ts accessor
export function GET(): Response {
  if (!token) return new Response("Not configured", { status: 404 });
  return new Response(token, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8",
               "cache-control": "no-store" },   // token rotates; never cache
  });
}
```

Requirement (verified verbatim): the URL must return only this plugin's
token; host must be the MCP hostname or a parent. Env var
`OPENAI_APPS_CHALLENGE_TOKEN`, documented in `.env.example` and CLAUDE.md.
Tests: 404 when unset, exact token body when set, `no-store` header.

## Step 2: annotations audit

Verify every `/api/mcp` tool carries `readOnlyHint: true` and correct
`openWorldHint`/`destructiveHint` values ("incorrect or missing action
labels are a common cause of rejection"). This is an assertion added to
`server-tools.test.ts`: every tool's annotations object includes
`readOnlyHint: true` and `destructiveHint: false`.

## Step 3: submission document

New `docs/chatgpt-app-submission.md` with no placeholders:

- Identity: app name "Chapa" (customer-facing product name; not generic),
  support contact, privacy policy URL, MCP Server URL
  `https://chapa.thecreativetoken.com/api/mcp`.
- Privacy policy check: confirm `/privacy` covers data categories,
  purposes, recipients, retention, and user controls; list any gap as a
  concrete edit to the privacy page (do the edit in this phase if small).
- 5 positive test cases (prompt, expected behavior, result shape, fixture):
  1. "What is my Chapa impact score?" with handle juan294 ->
     `get_impact_profile` returns score/tier/archetype.
  2. "Compare juan294 with octocat" -> `compare_profiles` diffs.
  3. "Is this badge verified? hash 84567a48984e0c2e287acb78d1404a57" ->
     `verify_badge` returns the record (the hash already used in
     `docs/webmcp-demo-script.md`).
  4. "How is the Delivery dimension calculated for juan294?" ->
     `explain_dimension`.
  5. "Give me the README embed for juan294" -> `get_embed_snippet`.
- 3 negative test cases (expected refusal or fallback, reasoning):
  1. Invalid handle ("compare me with not_a-real--handle!") -> recovery
     message from `isValidHandle`, no crash.
  2. Unknown handle with no data -> friendly "no profile yet" message.
  3. A request to change data ("save my badge config") -> tool absent;
     the model must state the action needs the website (no mutation tools
     are exposed by design).

## Step 4: manual submission steps (user)

Listed in the doc, all user-authorized:
1. Verify individual/org identity in the OpenAI Platform dashboard
   (mandatory; non-owner submitters need Apps Management: Write).
2. Set `OPENAI_APPS_CHALLENGE_TOKEN` in Vercel production (production env
   change: user authorizes; agent executes via Vercel CLI).
3. Portal: Create plugin, With MCP path, server URL, test cases, submit.
   No fee; review timeline unspecified.

## Success criteria

Automated: challenge route tests + annotations assertion green; full suite
green.

Manual: challenge URL serves the token in production; submission filed;
acceptance is outside our control and not a gate for anything else.

# Phase 8: agent-operability write-up + landing transcript link (#1261)

Branch: `docs/1261-agent-operability-writeup`
Depends on: phase 1 (landing edit); best after phase 7 (links live
listings as proof).

Raw material already in the repo:

- `docs/webmcp-explained-and-how-i-shipped-it.md` (the draft this phase
  finalizes)
- `docs/webmcp.md` (catalog + the goal-first design methodology)
- `docs/webmcp-demo-script.md` (the transcript source; production evidence
  for v2.28.0 already recorded in it)
- The `SITE_TOOL_MAP` contract-test pattern, worth presenting by name as
  "the published tool map is a tested contract"

## Step 1: finalize the article

Edit `docs/webmcp-explained-and-how-i-shipped-it.md` to cover, in order:
why runtime registration is invisible to most agents; the four-surface
goal-first design; the drift-test contract; the human-confirmation
boundary for saves; the discoverability work from this track (static
declarations, directories, remote MCP endpoint) with live links; and the
measured numbers from phase 5 telemetry if any exist by then. Follow the
four writing rules (no em-dashes, simple technical English, no emojis).
Nothing unreleased is mentioned.

## Step 2: the transcript

Produce a cleaned agent-session transcript (the demo-script flow:
`get_site_capabilities` -> `find_profile` -> studio co-design ->
verification) as `docs/webmcp-demo-transcript.md`. Source: an actual
session in flagged Chrome against production, captured while executing
the demo script; if the hackathon recording session already produced one,
reuse it.

## Step 3: landing link

Small edit to the phase 1 `#agent-tools` section in
`LandingContent.tsx`: one anchor "Read how this was built" pointing at
the published article URL, plus the i18n key pair. Ship this edit only
when the article URL exists.

## Step 4: publish (user decision)

Venue is the user's call at execution time: dev.to and/or personal blog;
HN optional. The agent prepares the final Markdown adapted per venue; the
user authorizes each publication (outward-facing).

## Success criteria

Automated: existing landing tests green after the link edit; docs pass
`pnpm run test` (no doc-lint gate exists; do not add one).

Manual: article live at a public URL; landing links it; #1261 closed with
the URLs.

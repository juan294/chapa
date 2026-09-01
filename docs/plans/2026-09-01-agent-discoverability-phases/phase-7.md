# Phase 7: release + directory and registry submissions (#1255, #1258, #1259 registries)

Depends on: phases 1-5 released to production (release PR to `main` per
`docs/release/release-playbook.md`; separate user authorizations for PR,
merge, and tag).

No code. Every submission is outward-facing: per Production Safety each
one gets an explicit user go-ahead before the form is submitted. Execution
order follows the CLI > Browser > Ask rule; all of these are browser-form
tasks, done with the Claude-in-Chrome tools, with the user confirming each
final submit.

## Step 0: pre-flight (agent, read-only)

1. Confirm production serves the new surfaces:
   `curl https://chapa.thecreativetoken.com/llms.txt | grep WebMCP`,
   same for `/llms-full.txt` and `/.well-known/mcp.json`.
2. Confirm the tool registration is live:
   `https://webmcp.com/api/v1/lookup?url=https://chapa.thecreativetoken.com`
   (before listing it may 404; that is expected; the scanner runs at
   submission).

## Step 1: WebMCP directories (#1255), verified mechanics

| Directory | How | Fields |
|---|---|---|
| webmcp.com | "Add your site" box on homepage | site URL, email; scanner verifies live tools before listing |
| webmcpdirectory.com | form at /submit | URL of a page with registered tools (use `https://chapa.thecreativetoken.com/`), 20-300 char description, category, email (private) |
| webmcplist.com | homepage form | name, URL, description, category, optional email, up to 10 tools (list the 9 public read tools + save_badge_config noted as human-gated, or the landing pair; pick the 10 most useful) |

Email to use: support@chapa.thecreativetoken.com.
Description (reusable, under 300 chars): "Chapa generates a live,
verifiable developer impact badge from GitHub activity. Agents can read
and compare public impact profiles, verify badge integrity, explain
scores, and co-design badge styles in Creator Studio through 18 WebMCP
tools across 4 pages."

## Step 2: llms.txt directories (#1258)

- https://llmstxt.site/submit
- https://directory.llmstxt.cloud/submit (free base listing only)

## Step 3: MCP registries (#1259, needs `/api/mcp` live and flag on)

1. Official registry: `brew install mcp-publisher`; `mcp-publisher init`
   generating `server.json` at the repo root (name under the
   `io.github.juan294/*` namespace via GitHub login, or DNS auth for
   `com.thecreativetoken.*`); `mcp-publisher publish`. Remote-server entry
   pointing at `https://chapa.thecreativetoken.com/api/mcp`. `server.json`
   is committed.
2. mcpservers.org: form at /submit (name, description, repo/docs link,
   category, email). Free tier only.
3. Glama: "Add Server", then claim the listing.
4. mcp.so: optional; form at /submit. Skip without discussion if it
   requires anything beyond the public repo link.

## Step 4: verification loop (agent, read-only)

After listings process: `webmcp.com/api/v1/lookup?url=...` returns Chapa;
each directory's public page shows the listing; the official registry
serves the `server.json` entry. Record listing URLs in a comment on
#1255/#1258 and close both issues.

## Success criteria

Automated: the two curl pre-flight checks and the lookup API check.

Manual: user go-ahead per submission; listings visible (some directories
review asynchronously; "submitted, pending review" closes the issue with
a note, and the verification loop re-runs on the next session).

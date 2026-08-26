# WebMCP runtime spike

Date: 2026-08-26 CEST (artifact path follows the planned 2026-08-27 workday).
Plan: `2026-08-26-webmcp-studio-tools.md`, Phase 0.

## Gate result

**BLOCKED — do not start Phase 1.** Neither required judging client called the
preview tool in this run. This activates Phase 0's hard stop until one client
executes `chapa_hello` successfully.

This is not evidence that Chapa is incompatible with WebMCP. Chrome reached the
preview with the native API disabled, and the ChatGPT in-app Browser runtime was
not available in this Codex session. The native enabled-runtime test therefore
remains incomplete.

## Exact candidate and preview

- Commit: `3156fcaa` (`feat(webmcp): add runtime spike`).
- Local tree at deploy: clean committed spike source.
- Vercel deployment: `dpl_7vugbqSNj9zSWNLbitxmQJHF5aXb`.
- Preview: `https://chapa-m1wo5d7s2-thecreativetoken.vercel.app`.
- Spike route: `/webmcp-spike`.
- Vercel status: Ready; target `preview`.
- `/api/version`: HTTP 200 through authenticated Vercel CLI access and
  `environment: "preview"`. `commitSha` is `null` because this was a direct CLI
  deployment rather than a Git-integrated preview; the deployment source was
  the clean local commit above.
- Anonymous requests receive Vercel's SSO redirect. Chrome's existing Vercel
  session reached the Chapa page, so Deployment Protection did not cause the
  Chrome runtime result.

The Vercel build compiled Next.js successfully, completed TypeScript checks,
and emitted `/webmcp-spike` as a dynamic route.

## Spike contract

The preview-only client uses the pinned contract:

- exact feature detection: `"modelContext" in document`;
- `document.modelContext.registerTool(tool, { signal })`;
- one effect-scoped `AbortController`, aborted during React cleanup;
- `chapa_hello` returns `Hello from Chapa Creator Studio`;
- `annotations: { readOnlyHint: true }`;
- missing or malformed support and registration failures leave the page usable.

Production returns `notFound()` for the spike route, and the route is
`noindex, nofollow`.

## Client results

### Chrome 151

- Runtime: Google Chrome `151.0.7922.174`.
- Preview access: PASS. The page rendered with its expected title and content.
- Native API discovery: FAIL (setup incomplete). The page reported
  `WebMCP is not available in this browser`, and
  `"modelContext" in document` evaluated to `false`.
- The Chrome testing flag is not active in this browser. Browser automation is
  not permitted to open `chrome://flags`, so this run could not enable
  `chrome://flags/#enable-webmcp-testing` or relaunch Chrome.
- Model Context Tool Inspector execution: not run because the provider API was
  absent. Installing a browser extension also requires an action-time user
  confirmation.

### ChatGPT in-app browser

- Runtime discovery: unavailable in this Codex session (`iab` had no available
  browser binding).
- Preview access, tool discovery, and execution: not run.
- Result: incomplete, not a WebMCP compatibility failure.

## Origin isolation and origin trial

The preview response does not include `Origin-Agent-Cluster` or `Origin-Trial`.
It also does not send `Origin-Agent-Cluster: ?0`.

Chrome's current WebMCP documentation says WebMCP is available only to
origin-isolated documents and is disabled when `document.domain` is enabled,
for example by `Origin-Agent-Cluster: ?0`. The current response does not opt out,
so there is no evidence that Chapa needs an explicit
`Origin-Agent-Cluster: ?1` header. Do not add it unless the enabled-runtime test
shows an isolation error.

The official Chrome Origin Trials registry lists WebMCP as active for Chrome
149 through 156, ending 2026-11-17. Therefore an origin-trial token is required
for unflagged Chrome 151 visitors. A token was not registered in this run because
registration creates an outward-facing persistent origin enrollment and the
local testing flag must be tried first.

Sources:

- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/origintrials/#/view_trial/4163014905550602241
- https://webmachinelearning.github.io/webmcp/

## Polyfill decision

**NO-GO for a polyfill at this point.** The native API has not failed in an
enabled runtime; it was absent because the required flag or origin-trial token
was not active. Adding `@mcp-b/global` now would hide the setup boundary and
would not prove that either judging client discovers page tools. Reconsider only
after a flagged Chrome run or an origin-trial run reaches the page and native
registration still fails for a verified compatibility reason.

## Automated evidence

- Focused Phase 0 tests: 2 files, 9 tests passed.
- Pre-commit full suite: 481 files, 7,907 tests passed.
- Typecheck: passed.
- Lint: passed.
- Plan-compliance review: approved for preview deployment.
- Simplify review: no reuse or efficiency findings; quality findings were fixed
  with malformed-context, synchronous-failure, stale-completion, and production
  `notFound()` tests.

## Required unblock

1. In Chrome, enable `chrome://flags/#enable-webmcp-testing` and relaunch.
2. Reopen the preview route. The page must report `WebMCP tool registered`.
3. Execute `chapa_hello` with the Model Context Tool Inspector or the browser's
   native `getTools()` / `executeTool()` test surface and record the greeting.
4. If the in-app Browser becomes available, repeat discovery and execution there.

If Chrome executes the tool, Phase 0 passes under the plan's one-client rule and
the demo video must use Chrome. If Chrome still fails and the in-app Browser is
still unavailable, keep the hard stop and escalate to the Summon fallback.

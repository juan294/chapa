# WebMCP runtime spike

Date: 2026-08-27 CEST.
Plan: `2026-08-26-webmcp-studio-tools.md`, Phase 0.

## Gate result

**PASS — proceed to Phase 1.** Flagged Chrome 151 registered, discovered, and
executed `chapa_hello` on the preview. The visible result was
`Hello from Chapa Creator Studio`. This satisfies Phase 0's one-client rule.

## Exact candidate and preview

- Commit: `b338942d` (`test(webmcp): add main-world execution probe`).
- Local tree at deploy: clean committed spike source.
- Vercel deployment: `dpl_Fy6fh23RPUwbdY8zfS7CHijpZnjp`.
- Preview: `https://chapa-54z2w6awa-thecreativetoken.vercel.app`.
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
- `chrome://flags/#enable-webmcp-testing`: enabled by Juan; Chrome relaunched.
- Native registration: PASS. The page reported `WebMCP tool registered`.
- Native discovery: PASS. `getTools()` returned `chapa_hello`.
- Native execution: PASS. `executeTool()` returned
  `Hello from Chapa Creator Studio`, displayed in the page's live output.
- Model Context Tool Inspector installation was authorized, but the Chrome Web
  Store blocks scripted control. The equivalent Chrome testing interfaces were
  exercised from a preview-only main-world probe instead; see the plan deviation
  note.

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
and native registration and execution passed. Chapa does not need an explicit
`Origin-Agent-Cluster: ?1` header for the tested preview runtime.

The official Chrome Origin Trials registry lists WebMCP as active for Chrome
149 through 156, ending 2026-11-17. An origin-trial token is required for
unflagged Chrome 151 visitors, but it was not needed for the flagged judging
client preview test. Production enrollment remains a separately gated action.

Sources:

- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/origintrials/#/view_trial/4163014905550602241
- https://webmachinelearning.github.io/webmcp/

## Polyfill decision

**NO-GO for a polyfill.** The native API passed registration, discovery, and
execution in flagged Chrome 151. Adding `@mcp-b/global` would add dependency and
CSP surface without solving a demonstrated compatibility problem.

## Automated evidence

- Focused Phase 0 tests: 2 files, 13 tests passed.
- Pre-commit full suite: 481 files, 7,911 tests passed.
- Typecheck: passed.
- Lint: passed.
- Plan-compliance review: approved for preview deployment.
- Simplify review: no reuse or efficiency findings; quality findings were fixed
  with malformed-context, synchronous-failure, stale-completion, and production
  `notFound()` tests.

## Phase 0 decision

Proceed with Chapa. Use flagged Chrome for implementation previews and the demo
video unless the ChatGPT in-app browser becomes available later. Do not add an
OAC header or polyfill. Register an origin-trial token only as an explicit
production-readiness action if the final judge instructions must work without
the Chrome testing flag.

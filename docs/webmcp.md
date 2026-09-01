# WebMCP in Chapa

Chapa exposes 19 browser-native WebMCP page/tool registrations across 18 distinct names; `explain_dimension` is shared by Studio and public profiles. They let an agent work on the same page state that a person can see. Studio mutations use the existing command system. Landing, public profile, and verification tools are read-only.

Public tools that can return GitHub-controlled names or fetched public content also set `untrustedContentHint: true`. Verification records are projected to their public shape and never expose the internal confidence value.

Runtime status in this document is based on the 2026-08-27 preview-only `chapa_hello` spike. Flagged Google Chrome 151 passed native registration, discovery, and execution for that hello-world tool. The completed catalog still needs final production verification after release and flag enablement. The ChatGPT in-app browser was not available in that Codex session, so it remains untested. This is not evidence of a ChatGPT compatibility failure.

## Input schema shorthand

The catalog uses these exact JSON Schema objects:

- `EMPTY`: `{"type":"object","properties":{},"additionalProperties":false}`
- `STYLE`: `{"type":"object","properties":{"category":{"type":"string"},"value":{"type":"string"}},"required":["category","value"],"additionalProperties":false}`
- `PRESET`: `{"type":"object","properties":{"name":{"type":"string","enum":["minimal","premium","holographic","maximum"]}},"required":["name"],"additionalProperties":false}`
- `SIMULATION`: `{"type":"object","properties":{"dimensions":{"type":"object","properties":{"delivery":{"type":"number","minimum":0,"maximum":100},"quality":{"type":"number","minimum":0,"maximum":100},"consistency":{"type":"number","minimum":0,"maximum":100},"breadth":{"type":"number","minimum":0,"maximum":100},"craft":{"type":"number","minimum":0,"maximum":100}},"additionalProperties":false}},"required":["dimensions"],"additionalProperties":false}`
- `DIMENSION`: `{"type":"object","properties":{"dimension":{"type":"string","enum":["delivery","quality","consistency","breadth","craft"]}},"required":["dimension"],"additionalProperties":false}`
- `COMPARE`: `{"type":"object","properties":{"other_handle":{"type":"string"}},"required":["other_handle"],"additionalProperties":false}`
- `HANDLE`: `{"type":"object","properties":{"handle":{"type":"string"}},"required":["handle"],"additionalProperties":false}`

`readOnlyHint: no` means the annotation is omitted because the tool changes page state or opens a human action gate.

## Tool catalog

### Landing page: `/`

These tools orient and navigate only. They fetch no data and do not wrap the public REST API.

| Tool | Input | `readOnlyHint` | Behavior |
| --- | --- | --- | --- |
| `get_site_capabilities` | `EMPTY` | yes | Describes Chapa and returns the exact page-scoped tool map, canonical entry points, and human-action boundaries. |
| `find_profile` | `HANDLE` | yes | Validates a public GitHub handle and returns its canonical share-page and badge URLs plus navigation notes. It makes no request. |

### Creator Studio: `/studio` and `/studio?demo=1`

| Tool | Input | `readOnlyHint` | Behavior |
| --- | --- | --- | --- |
| `list_style_options` | `EMPTY` | yes | Returns every style category, option, preset, and the current badge configuration. It does not change state. |
| `apply_badge_style` | `STYLE` | no | Runs the equivalent visible `/set <category> <value>` command. It returns terminal output and the resulting configuration snapshot. |
| `apply_preset` | `PRESET` | no | Runs the equivalent visible `/preset <name>` command. It returns terminal output and the resulting configuration snapshot. |
| `preview_badge` | `EMPTY` | yes | Returns the current configuration, public badge SVG URL, and save status. |
| `reset_badge_config` | `EMPTY` | no | Runs the visible `/reset` command and returns terminal output plus the reset configuration snapshot. |
| `save_badge_config` | `EMPTY` | no | Opens an on-page save proposal. It never calls the save API itself. Only a human click on the confirmation control can continue. |
| `simulate_score` | `SIMULATION` | yes | Merges the supplied dimension values with the current profile, calculates composite and confidence-adjusted scores, selects the tier, and returns the delta from the current score. Solo profiles exclude Quality from the composite. It does not save data. |
| `suggest_improvements` | `EMPTY` | yes | Runs Chapa's existing insight engine against the current impact profile and returns grounded improvement suggestions. |
| `explain_dimension` | `DIMENSION` | yes | Uses the shared score-explanation engine to return the selected score, formula, tip, and normalized submetrics. |

### Public profile: `/u/[handle]`

These tools receive the same server-computed public data as the rendered page. Visitor payloads are redacted before they cross the client boundary.

| Tool | Input | `readOnlyHint` | Behavior |
| --- | --- | --- | --- |
| `get_impact_profile` | `EMPTY` | yes | Serializes the redacted impact, key public stats, verification summary, trend, diff, and render-time freshness from page props. It makes no request. |
| `get_impact_history` | `EMPTY` | yes | Fetches `/api/history/[handle]?include=snapshots,trend` with the tool cancellation signal. It returns friendly messages for missing or rate-limited data. |
| `verify_badge` | `EMPTY` | yes | If the page has a verification hash, fetches `/api/verify/[hash]` and returns status, record, and `verifyUrl`. Otherwise it reports that the profile has no verification record. |
| `explain_dimension` | `DIMENSION` | yes | Uses the same shared explanation tool as Studio. It operates on the current public page data. |
| `compare_profiles` | `COMPARE` | yes | Validates the other public GitHub handle, fetches `/api/profile/[other_handle]`, and returns the two public profiles with numeric score and dimension differences. The differences are other profile minus the on-page profile. Missing and rate-limited profiles get friendly messages. |
| `get_embed_snippet` | `EMPTY` | yes | Returns the page's canonical Markdown and HTML embed snippets for the live badge. |

### Verification page: `/verify/[hash]`

These tools are present only when the page found a verification record.

| Tool | Input | `readOnlyHint` | Behavior |
| --- | --- | --- | --- |
| `get_verification_record` | `EMPTY` | yes | Serializes the hash and the verification record already displayed on the page. It makes no request. |
| `explain_verification` | `EMPTY` | yes | Explains the HMAC-SHA256 process, what the record proves, what it does not prove, record expiry, and whether the displayed code is current or legacy format. |

## Remote MCP endpoint

`https://chapa.thecreativetoken.com/api/mcp` is Chapa's stateless Streamable HTTP endpoint for clients that do not operate a browser page. It is independently gated by the DB-backed `mcp_server_enabled` flag with the server-only `MCP_SERVER_ENABLED` fallback. The endpoint exposes 9 public read-only tools and uses the same raw JSON Schemas and hand-written validation as the browser WebMCP catalog.

| Remote tool | Difference from the browser twin |
| --- | --- |
| `get_site_capabilities` | Identifies the remote transport and endpoint. |
| `find_profile` | No difference; it remains pure URL construction. |
| `get_impact_profile` | Takes `{handle}` instead of reading the current page. |
| `get_impact_history` | Takes `{handle}` and calls the history library directly. |
| `verify_badge` | Takes `{hash}` instead of reading the page's verification state. |
| `explain_verification` | No difference; it returns the shared explanation. |
| `explain_dimension` | Takes `{handle, dimension}` and materializes public profile data read-only. |
| `compare_profiles` | Takes `{handle, other_handle}` because there is no on-page current profile. |
| `get_embed_snippet` | Takes `{handle}` and builds the canonical English snippets. |

Studio mutation tools are browser-only by design. They change visible page state, and saves require an explicit human click on the on-page confirmation control. The remote endpoint therefore cannot apply styles, reset a session, or save a badge configuration.

## Design methodology

Chapa follows the framework in Chrome's [Build your user's agentic workflows with WebMCP tools](https://developer.chrome.com/docs/ai/webmcp/build-tools) article, published on 2026-08-26. The framework defines the user goal and initial state, then role-plays the conversation to find the required tools and recovery paths. The [WebMCP demo script](webmcp-demo-script.md) is Chapa's role-play artifact.

### Landing page

**User goal:** Discover what Chapa is and which page-scoped tools exist, then navigate to the right page.

**Initial state:** Open `/` as any visitor with no authentication. `webmcp_enabled` must be on. The landing catalog is the site's front-door tool map.

**Role-play:** [The agent finds its own way in](webmcp-demo-script.md#000-022--the-agent-finds-its-own-way-in).

### Creator Studio

**User goal:** Co-design the badge and propose a save that the human confirms.

**Initial state:** Open authenticated `/studio`, or open `/studio?demo=1` with seeded fixtures. `studio_enabled` and `webmcp_enabled` must be on. Demo mode also requires `studio_demo_enabled`.

**Role-play:** [Studio co-design, visible changes, human-gated save](webmcp-demo-script.md#022-130--studio-co-design-visible-changes-human-gated-save).

### Public profile

**User goal:** Read, compare, verify, and embed a public developer credential.

**Initial state:** Open any `/u/:handle` page with computed stats. Visitor payloads are redacted on the server before they enter the client tree.

**Role-play:** [Read the public claim, then close the trust loop](webmcp-demo-script.md#130-220--read-the-public-claim-then-close-the-trust-loop).

### Verification page

**User goal:** Confirm what a verification code proves and what it does not prove.

**Initial state:** Open `/verify/:hash` with a found verification record.

**Role-play:** [Verify the known badge code](webmcp-demo-script.md#148-205--verify-the-known-badge-code).

### Failure and recovery

| Error class | Example tool | Response the agent receives |
| --- | --- | --- |
| Wrong state / missing prerequisite | `save_badge_config` with nothing dirty | `No unsaved changes. The current configuration is already saved.` |
| Invalid parameters | `apply_badge_style` with a malformed token | `Invalid input for apply_badge_style: category and value must be single non-empty tokens; call list_style_options for valid categories and values.` |
| Unexpected upstream data | `compare_profiles` when the other handle has no snapshot | `No public impact profile was found for @<handle>. A profile is generated on first visit: ask the user to open https://chapa.thecreativetoken.com/u/<handle> once, then retry this comparison.` |
| Business-rule violation | `save_badge_config` in any state | The save API is never called by the agent. Only the on-page human confirmation can continue. |

The new `apply_badge_style` invalid-input response names `list_style_options` as the next call. Wrong-state save responses explain why no action is needed or name `preview_badge` as the next tool. The new `compare_profiles` 404 response gives the profile-generation URL and tells the agent to retry.

## Three drivers, one Studio state

Quick Controls, terminal input, and agent style tools use one command registry. This keeps the terminal transcript, React configuration, preview, and save state consistent.

```text
Quick Controls clicks ──> /set, /preset, /reset, /save ──┐
Typed terminal input ──> command text ────────────────────┼─> handleSubmit
Agent style tools ─────> command text through runCommand ─┘       |
                                                                  v
                                               executeCommand(studioCommands)
                                                                  |
                                                                  v
                                                   CommandResult + action
                                                                  |
                          ┌───────────────────────────────────────┼──────────────────────┐
                          v                                       v                      v
                  visible terminal lines                  shared React config       save handler
                                                                  |                      |
                                                                  v                      v
                                                          live badge preview        real mode: PUT
                                                                                   demo: local only

Agent save_badge_config ──> on-page proposal ──> human confirm ──> save handler
```

The save tool is intentionally separate from direct command execution. An agent can propose a save, but it cannot confirm one. The human remains the final authority.

## Registration and cleanup

Chapa feature-detects the imperative API with `"modelContext" in document` and also checks that `registerTool` is callable. When support is present, each React host uses the pinned API contract:

```ts
const controller = new AbortController();

document.modelContext.registerTool(tool, {
  signal: controller.signal,
});

// React effect cleanup
controller.abort();
```

The complete tool array is memoized. A catalog-definition change causes the effect to abort the previous registrations and register the current tools. State-only changes keep registrations stable while calls resolve the latest execute implementation. Registration failures and missing or malformed browser support do not break the page. Tool calls emit `webmcp_tool_called` once at settle time with `outcome: ok | invalid_input | error` and `durationMs`. Thrown errors also emit a bounded `client_error` event and still reject to the caller.

Three feature flags control exposure:

- `studio_enabled` controls Creator Studio itself.
- `webmcp_enabled` is the remote WebMCP kill switch. When it is false, Studio builds no catalog and public pages omit the client hosts.
- `studio_demo_enabled` controls anonymous access to `/studio?demo=1`. It does not bypass `studio_enabled`.

Browsers without `document.modelContext` get the normal Chapa interface with no WebMCP tools. No polyfill is shipped because the native flagged runtime passed and a polyfill would add dependency and CSP surface without solving a demonstrated failure.

## Judge demo

The deployment must have `studio_enabled`, `studio_demo_enabled`, and `webmcp_enabled` enabled before this sequence.

An agent can start from the landing page, call `get_site_capabilities`, and follow its `demoStudio` entry point to the demo Studio.

1. Complete the Chrome setup below and open `/studio?demo=1` while logged out.
2. Confirm that the page shows the persistent `DEMO` marker and the seeded Bertram Gilfoyle profile.
3. Discover the nine Studio tools.
4. Call `list_style_options`, then use `apply_preset` or `apply_badge_style`. The command appears in the terminal and the badge preview changes on the same screen.
5. Call `simulate_score` or `explain_dimension` to exercise the pure scoring engines.
6. Call `save_badge_config`. The tool only opens the on-page confirmation gate. Click Confirm as the human judge.
7. Confirm the terminal message `(demo) configuration not persisted`.

Demo mode is session-free and uses fixed local fixtures. Configuration changes remain in the current page. Even after human confirmation, demo mode makes no `PUT /api/studio/config` request and changes no real profile.

For the public trust flow, open a real `/u/[handle]` page, call `get_impact_profile`, then call `verify_badge` and `get_embed_snippet`. Confirm that the returned Markdown matches the on-page embed snippet. Follow the returned `verifyUrl` to use `get_verification_record` and `explain_verification` on the verification page.

## Chrome 151 setup

The verified development path uses Google Chrome 151:

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Set **WebMCP testing** to **Enabled**.
3. Relaunch Chrome when prompted.
4. Open the Chapa page and use a compatible WebMCP client to list and execute its tools.

Optional Inspector path:

1. Install the **Model Context Tool Inspector** extension from the Chrome Web Store.
2. Open its interface for the Chapa tab.
3. List the registered tools and execute a read-only tool first, such as `list_style_options` or `get_impact_profile`.

The Inspector path was not completed in the 2026-08-27 automated spike because the Chrome Web Store blocked scripted control. The spike instead used Chrome's flagged main-world testing interfaces, `getTools()` and `executeTool()`, and proved native registration, discovery, and execution on the preview.

## Origin isolation and origin trial

Chrome requires WebMCP documents to be origin-isolated and disables WebMCP when `document.domain` is enabled, for example through `Origin-Agent-Cluster: ?0`.

The tested preview sent no `Origin-Agent-Cluster` header, no `Origin-Trial` header, and no `Origin-Agent-Cluster: ?0` opt-out. Flagged Chrome 151 still registered and executed the tool. Chapa therefore does not need an explicit `Origin-Agent-Cluster: ?1` header for the tested flag-based setup.

The Chrome Origin Trials registry listed WebMCP as active for Chrome 149 through 156, with an end date of 2026-11-17. An origin-trial token is required for unflagged Chrome 151 visitors. If judges will not enable `chrome://flags/#enable-webmcp-testing`, production must enroll its origin and serve a valid token before judging. Production enrollment and token installation are separate production actions.

## Runtime evidence and specifications

- [Chapa runtime spike](research/2026-08-27-webmcp-runtime-spike.md)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome Origin Trials registry](https://developer.chrome.com/origintrials/#/view_trial/4163014905550602241)
- [W3C WebMCP specification](https://webmachinelearning.github.io/webmcp/)

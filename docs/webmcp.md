# WebMCP in Chapa

Chapa exposes 16 browser-native WebMCP page/tool registrations across 15 distinct names; `explain_dimension` is shared by Studio and public profiles. They let an agent work on the same page state that a person can see. Studio mutations use the existing command system. Public profile and verification tools are read-only.

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

`readOnlyHint: no` means the annotation is omitted because the tool changes page state or opens a human action gate.

## Tool catalog

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

### Verification page: `/verify/[hash]`

These tools are present only when the page found a verification record.

| Tool | Input | `readOnlyHint` | Behavior |
| --- | --- | --- | --- |
| `get_verification_record` | `EMPTY` | yes | Serializes the hash and the verification record already displayed on the page. It makes no request. |
| `explain_verification` | `EMPTY` | yes | Explains the HMAC-SHA256 process, what the record proves, what it does not prove, record expiry, and whether the displayed code is current or legacy format. |

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

The complete tool array is memoized. A catalog-definition change causes the effect to abort the previous registrations and register the current tools. State-only changes keep registrations stable while calls resolve the latest execute implementation. Registration failures and missing or malformed browser support do not break the page. Tool calls emit `webmcp_tool_called`; execution failures emit a bounded `client_error` event and still reject to the caller.

Three feature flags control exposure:

- `studio_enabled` controls Creator Studio itself.
- `webmcp_enabled` is the remote WebMCP kill switch. When it is false, Studio builds no catalog and public pages omit the client hosts.
- `studio_demo_enabled` controls anonymous access to `/studio?demo=1`. It does not bypass `studio_enabled`.

Browsers without `document.modelContext` get the normal Chapa interface with no WebMCP tools. No polyfill is shipped because the native flagged runtime passed and a polyfill would add dependency and CSP surface without solving a demonstrated failure.

## Judge demo

The deployment must have `studio_enabled`, `studio_demo_enabled`, and `webmcp_enabled` enabled before this sequence.

1. Complete the Chrome setup below and open `/studio?demo=1` while logged out.
2. Confirm that the page shows the persistent `DEMO` marker and the seeded Bertram Gilfoyle profile.
3. Discover the nine Studio tools.
4. Call `list_style_options`, then use `apply_preset` or `apply_badge_style`. The command appears in the terminal and the badge preview changes on the same screen.
5. Call `simulate_score` or `explain_dimension` to exercise the pure scoring engines.
6. Call `save_badge_config`. The tool only opens the on-page confirmation gate. Click Confirm as the human judge.
7. Confirm the terminal message `(demo) configuration not persisted`.

Demo mode is session-free and uses fixed local fixtures. Configuration changes remain in the current page. Even after human confirmation, demo mode makes no `PUT /api/studio/config` request and changes no real profile.

For the public trust flow, open a real `/u/[handle]` page, call `get_impact_profile`, then call `verify_badge`. Follow the returned `verifyUrl` to use `get_verification_record` and `explain_verification` on the verification page.

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

# WebMCP demo script and Devpost checklist

Target duration: 2 minutes 50 seconds. Do not exceed 3 minutes.

## Recording setup

- [ ] Use the production URL only after Juan authorizes the production release and flag changes.
- [ ] Use Chrome with `chrome://flags/#enable-webmcp-testing` enabled, then relaunch Chrome. A preview-only `chapa_hello` spike passed native registration, discovery, and execution in flagged Chrome 151 on 2026-08-27. The completed catalog must pass the production preflight below.
- [ ] Do not claim ChatGPT compatibility. The ChatGPT in-app browser has not been tested because no browser binding was available during the runtime spike.
- [ ] Open the WebMCP-capable agent or tool inspector beside the page so the agent, page, live preview, and terminal are visible on one screen.
- [ ] Prepare these tabs:
  - `TODO_LIVE_URL/studio?demo=1`
  - `TODO_LIVE_URL/u/TODO_PUBLIC_HANDLE`
  - `TODO_LIVE_URL/verify/TODO_VALID_HASH`
- [ ] Prepare one unknown hash by changing one hexadecimal character in `TODO_VALID_HASH`.
- [ ] Preload the public profile, valid verification, and unknown-hash tabs. Do not type URLs during the timed trust segment.
- [ ] Reset the demo Studio to its default configuration before recording.
- [ ] Confirm that `studio_enabled`, `webmcp_enabled`, and `studio_demo_enabled` are on before recording. This is a Juan-gated production action.
- [ ] Replace every placeholder, then confirm `rg -n 'TODO_[A-Z]' docs/webmcp-demo-script.md` returns no matches.

## Script

### 0:00-0:20 — Your badge, your agent, one screen

**On screen**

Show `TODO_LIVE_URL/studio?demo=1`, the persistent `DEMO` marker, the badge preview, the terminal, and the agent or tool inspector together.

**Say**

> Chapa is a developer credential that a person and agent design on one screen. Agent actions appear in the terminal and badge. This session-free demo uses fixed fixtures and cannot write production data.

### 0:20-1:30 — Studio co-design, visible changes, human-gated save

**0:20-0:32 — Give the agent the design goal**

**Type or say to the agent**

> Show the choices, apply Maximum, and stop before saving.

**Expected agent calls**

1. `list_style_options`
2. `apply_preset` with `{ "name": "maximum" }`

**On screen**

Keep the badge and terminal visible. Pause long enough to show the preview re-render and the matching command result in the terminal.

**0:32-0:52 — Let the agent make a second visible change**

**Type or say to the agent**

> Keep the border and spring stats. Use a solid background.

**Expected agent call**

`apply_badge_style` with `{ "category": "background", "value": "solid" }`

**On screen**

Show the second re-render. Point to the terminal line that records the same action the human can issue as a command.

**0:52-1:08 — Human interruption**

**Interrupt before the agent continues**

> No confetti. Keep everything else.

**Expected agent call**

`apply_badge_style` with `{ "category": "celebration", "value": "none" }`

**Say**

> I can redirect it at any time. Agent actions use the same path as visible controls and terminal commands.

**1:08-1:30 — Propose, then require the human click**

**Type or say to the agent**

> Propose this configuration for saving.

**Expected agent call**

`save_badge_config`

**On screen**

1. Show the on-page save proposal.
2. Keep the pointer away from the confirm button for one beat.
3. Say: "The agent can only propose this write."
4. Click **Confirm save** yourself.
5. Show the terminal result: `(demo) configuration not persisted`.

**Say**

> Only my click crosses the gate. Demo confirmation stays local.

### 1:30-2:20 — Read the public claim, then close the trust loop

**1:30-1:48 — Read the public profile**

Open `TODO_LIVE_URL/u/TODO_PUBLIC_HANDLE`.

**Type or say to the agent**

> Read this profile, then verify its badge.

**Expected first call**

`get_impact_profile`

**On screen**

Show the public, redacted profile result and its page-render freshness metadata.

**Say**

> These tools make public claims discoverable. The live Studio session is the leverage core.

**1:48-2:05 — Verify the known badge code**

**Expected second call**

`verify_badge`

**On screen**

Show `status: "verified"`, the stored original record, and the verification URL. Open `TODO_LIVE_URL/verify/TODO_VALID_HASH` if needed.

**Say**

> Chapa derives the code with HMAC-SHA256. A successful lookup returns Chapa's stored record for comparison with the badge.

**2:05-2:20 — Show an unknown or altered code failing lookup**

Change one hexadecimal character in the verification URL and load it.

**On screen**

Show the not-found result for the altered code.

**Say**

> An altered code has no stored record. This proves Chapa issued the known code; it does not scan or re-sign SVGs.

### 2:20-2:50 — Architecture close

**On screen**

Show this compact architecture card or the matching source files:

```text
Quick Controls ----\
Typed terminal -----+--> one command registry --> live Studio state --> visible re-render
WebMCP agent -------/

real Studio: page inherits the human session
persistent save: agent proposes --> human confirms
public tools: readOnlyHint
demo saves: local only
```

**Say**

> One command registry has three drivers: clicks, terminal commands, and WebMCP. Real Studio tools inherit the human session. Agent saves require human confirmation; demo saves stay local. Public read tools close the trust story.

Stop recording by 2:50. Keep ten seconds of safety margin under the three-minute limit.

## Devpost submission checklist

### Required submission fields

- [ ] **Live application URL:** `TODO_LIVE_URL`
- [ ] **Public repository URL:** `TODO_PUBLIC_REPO_URL` — publication is Juan-gated.
- [ ] **YouTube demo URL:** `TODO_YOUTUBE_URL` — recording and upload are Juan-gated.
- [ ] **Concise description:**

  > Chapa makes a developer credential a shared human-agent surface. In Creator Studio, a WebMCP agent works inside the page's live state, drives the same command registry as clicks and terminal commands, and renders every change where the human can see it. The agent may propose a save, but only the human can confirm it. Public read tools add discovery and trust: an agent can read a redacted impact profile and look up its HMAC-derived verification record. The deep WebMCP leverage is session inheritance, shared UI state, and human-gated writes; the public tools close the story for agent-mediated hiring.

- [ ] **Prior work and new work statement:** link the [README eligibility receipts](../README.md#prior-work-and-submission-period-work), including the dated tags and WebMCP commit range.
- [ ] **License:** confirm the root MIT `LICENSE` is prominent on the public repository landing page.

### Judge instructions

1. Open `TODO_LIVE_URL/studio?demo=1`. No login is required. The `DEMO` marker must be visible, and confirmed saves are local-only.
2. In Chrome, open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch. The hello-world runtime spike was verified in flagged Chrome 151; confirm the completed production catalog during this judging preflight.
3. Use the Model Context Tool Inspector or another WebMCP-capable client to discover the Studio tools.
4. Call `list_style_options`, `apply_preset`, and `apply_badge_style`. Confirm that each action appears in the terminal and re-renders the badge.
5. Call `save_badge_config`. Confirm that no save occurs until a human clicks **Confirm save**, then confirm that demo mode reports `(demo) configuration not persisted`.
6. Open `TODO_LIVE_URL/u/TODO_PUBLIC_HANDLE`. Call `get_impact_profile`, then `verify_badge`.
7. Open the returned verification URL. Change one hex character to confirm that an unknown code has no stored verification record.
8. ChatGPT in-app browser support is **untested**, not known to fail. Use the tested Chrome setup for judging.

### Juan-gated execution order

Do not reorder these actions. Do not perform any production or outward-facing action without Juan's explicit authorization at that execution step.

1. [ ] **[JUAN GATE] Release to production:** run `/pre-launch` → `/remediate` → `/update-docs` → `/release` for the approved `develop` to `main` candidate, then verify its exact production identity. Target no later than August 31, 2026. `TODO_RELEASE_SHA`
2. [ ] **[JUAN GATE] Flip production flags without a deploy:** use the existing admin PATCH to enable `webmcp_enabled`, then `studio_demo_enabled`; verify the live tool list and logged-out `/studio?demo=1` access. `TODO_FLAG_EVIDENCE`
3. [ ] **[JUAN GATE] Publish the repository:** record the existing clean secret-scan receipt dated 2026-08-26, rerun gitleaks on the final publication HEAD, publish the approved repository, and verify that the MIT license renders prominently. `TODO_PUBLIC_REPO_URL`
4. [ ] **[JUAN GATE] Record and upload the video:** record against the verified production release, keep it under three minutes, and upload it publicly to YouTube. `TODO_YOUTUBE_URL`
5. [ ] **[JUAN GATE] Submit on Devpost:** verify every URL and judge step, then submit. Target **September 2, 2026**. `TODO_DEVPOST_SUBMISSION_URL`
6. [ ] **Freeze after submission:** schedule nothing on `main` and make no repository, application, or Devpost changes until winners are announced, expected around **September 23, 2026**, except an explicitly authorized emergency response.

Hard deadline: **September 3, 2026 at 13:00 PT**. The September 2 target keeps a full buffer day.

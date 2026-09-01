# WebMCP demo script and Devpost checklist

Target duration: 2 minutes 50 seconds. Do not exceed 3 minutes.

## Recording setup

- [x] Use the production URL only after Juan authorizes the production release and flag changes. Both are done: v2.29.1 includes the current discovery surfaces and the flags are enabled.
- [x] Use Chrome with `chrome://flags/#enable-webmcp-testing` enabled, then relaunch Chrome. A preview-only `chapa_hello` spike passed native registration, discovery, and execution in flagged Chrome 151 on 2026-08-27. The production preflight passed on 2026-09-01 with 19 registrations across 18 distinct names.
- [ ] Do not claim ChatGPT compatibility. The ChatGPT in-app browser has not been tested because no browser binding was available during the runtime spike.
- [ ] Open the WebMCP-capable agent or tool inspector beside the page so the agent, page, live preview, and terminal are visible on one screen.
- [ ] Prepare these tabs:
  - `https://chapa.thecreativetoken.com/` — the landing page, where the recording starts
  - `https://chapa.thecreativetoken.com/studio?demo=1`
  - `https://chapa.thecreativetoken.com/u/juan294`
  - `https://chapa.thecreativetoken.com/verify/84567a48984e0c2e287acb78d1404a57`
- [ ] Prepare one unknown hash by changing one hexadecimal character in `84567a48984e0c2e287acb78d1404a57`.
- [ ] Preload the public profile, valid verification, and unknown-hash tabs. Do not type URLs during the timed trust segment.
- [ ] Reset the demo Studio to its default configuration before recording.
- [x] Confirm that `studio_enabled`, `webmcp_enabled`, and `studio_demo_enabled` are on before recording. Verified 2026-09-01 against production: all three enabled since 2026-08-27, no flip needed. Re-check with `curl -s https://chapa.thecreativetoken.com/api/feature-flags | jq '.flags[] | select(.key|test("studio|webmcp"))'`.
- [ ] Replace the remaining placeholders. `rg -n 'TODO_[A-Z]' docs/webmcp-demo-script.md` should return exactly two, `TODO_YOUTUBE_URL` and `TODO_DEVPOST_SUBMISSION_URL`, until the video is uploaded and the submission is filed; it returns none once both are done.

## Script

### 0:00-0:22 — The agent finds its own way in

Start on the landing page, not in the Studio. The agent should discover where
to go rather than be handed a URL, because that is the claim this segment
makes. It also matches judge step 2.

**On screen**

Show `https://chapa.thecreativetoken.com/` with the agent or tool inspector beside it.

**Type or say to the agent**

> What can I do on this site, and where is juan294's badge?

**Expected agent calls**

1. `get_site_capabilities`
2. `find_profile` with `{ "handle": "juan294" }`

**On screen**

1. Show the returned tool map: four routes, each with the tools it carries.
2. Point to the `boundaries` field, which states that login is human-only and
   saves are human-confirmed, before any tool has been called.
3. Show `find_profile` returning the share and badge URLs. Keep this tab; the
   1:30 segment opens the URL the agent just resolved.
4. Follow the `demoStudio` entry point into `/studio?demo=1`.

**Say**

> Chapa is a developer credential that a person and agent design on one screen.
> The agent starts at the front door, reads which tools live on which page, and
> routes itself. It is told the boundaries up front. Now it follows its own
> entry point into the demo Studio, which uses fixed fixtures and cannot write
> production data.

**On screen, on arrival**

Show the persistent `DEMO` marker, the badge preview, and the terminal together
with the inspector.

### 0:22-1:30 — Studio co-design, visible changes, human-gated save

**0:22-0:32 — Give the agent the design goal**

**Type or say to the agent**

> Show the choices, apply Maximum, and stop before saving.

**Expected agent calls**

1. `list_style_options`
2. `apply_preset` with `{ "name": "maximum" }`

**On screen**

Keep the badge and terminal visible. Pause long enough to show the preview re-render and the matching command result in the terminal.

**0:32-0:52 — Let the agent make a second visible change**

**Type or say to the agent**

> Keep the spinning border and shimmering score. Use a solid background.

**Expected agent call**

`apply_badge_style` with `{ "category": "background", "value": "solid" }`

**On screen**

Show the second re-render. Point to the terminal line that records the same action the human can issue as a command.

**0:52-1:08 — Human interruption**

**Interrupt before the agent continues**

> Use a calmer column sweep. Keep everything else.

**Expected agent call**

`apply_badge_style` with `{ "category": "heatmapAnimation", "value": "fade-in" }`

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

Open the share URL `find_profile` returned at 0:00, not a typed address. The
callback is the point: the agent resolved this URL itself in the first segment.

**Let the page finish painting before you ask the agent anything.** The share
page registers its tools noticeably later than the Studio does, because it is
a heavier page and the tool host mounts after hydration. Measured against
production on 2026-09-01: `/studio?demo=1` had all 9 tools at 0ms, while
`/u/:handle` still reported **zero** tools 8.7 seconds after navigation and
then registered all 6 once hydration completed. An agent queried too early
sees an empty tool list, which reads as broken on camera.

Wait for the score, badge, and breakdown to be fully visible, then continue.
This costs about two seconds and is already inside this segment's budget.

**Type or say to the agent**

> Read this profile, then verify its badge.

**Expected first call**

`get_impact_profile`

**On screen**

Show the public, redacted profile result and its page-render freshness metadata.

**Say**

> These tools make public claims discoverable. The live Studio session is the leverage core.

#### 1:48-2:05 — Verify the known badge code

**Expected second call**

`verify_badge`

**On screen**

Show `status: "verified"`, the stored original record, and the verification URL. Open `https://chapa.thecreativetoken.com/verify/84567a48984e0c2e287acb78d1404a57` if needed.

**Say**

> Chapa derives the code with HMAC-SHA256. A successful lookup returns Chapa's stored record for comparison with the badge.

**2:05-2:20 — Show an unknown or altered code failing lookup**

Change one hexadecimal character in the verification URL and load it. A
prepared example, verified 2026-09-01: the valid code ends `...a57`, so load
`...a58`.

Expect an on-page not-found state, **not** a browser error page. The route
still responds 200 and renders the unverified state; only the API
(`/api/verify/<hash>`) answers 404. Verified against production: the altered
page renders "Could not", "No verification", "Not found" and "Unknown", with
no verified language, while the valid page is dominated by "Verified".

**On screen**

Show the not-found result for the altered code.

**Say**

> An altered code has no stored record. This proves Chapa issued the known code; it does not scan or re-sign SVGs.

### 2:20-2:50 — Architecture close

**On screen**

Show this compact architecture card or the matching source files:

```text
landing: get_site_capabilities --> tool map + boundaries --> agent routes itself

Quick Controls ----\
Typed terminal -----+--> one command registry --> live Studio state --> visible re-render
WebMCP agent -------/

real Studio: page inherits the human session
persistent save: agent proposes --> human confirms
public tools: readOnlyHint
demo saves: local only
```

**Say**

> The landing page hands an agent a map of the site and the boundaries it must
> respect, so it routes itself instead of guessing. From there, one command
> registry has three drivers: clicks, terminal commands, and WebMCP. Real Studio
> tools inherit the human session. Agent saves require human confirmation; demo
> saves stay local. Public read tools close the trust story.

Stop recording by 2:50. Keep ten seconds of safety margin under the three-minute limit.

## Devpost submission checklist

### Required submission fields

- [ ] **Live application URL:** `https://chapa.thecreativetoken.com`
- [x] **Public repository URL:** <https://github.com/juan294/chapa> — published and verified public.
- [ ] **YouTube demo URL:** `TODO_YOUTUBE_URL` — recording and upload are Juan-gated.
- [ ] **Concise description:**

  > Chapa makes a developer credential a shared human-agent surface. In Creator Studio, a WebMCP agent works inside the page's live state, drives the same command registry as clicks and terminal commands, and renders every change where the human can see it. The agent may propose a save, but only the human can confirm it. Public read tools add discovery and trust: an agent can read a redacted impact profile and look up its HMAC-derived verification record. The deep WebMCP leverage is session inheritance, shared UI state, and human-gated writes; the public tools close the story for agent-mediated hiring.

- [ ] **Prior work and new work statement:** link the [README eligibility receipts](../README.md#prior-work-and-submission-period-work), including the dated tags and WebMCP commit range.
- [ ] **License:** confirm the root MIT `LICENSE` is prominent on the public repository landing page.

### Judge instructions

1. In Chrome, open `chrome://flags/#enable-webmcp-testing`, enable WebMCP testing, and relaunch. The hello-world runtime spike was verified in flagged Chrome 151; confirm the completed production catalog during this judging preflight.
2. Open `https://chapa.thecreativetoken.com/`. Call `get_site_capabilities` and follow its `demoStudio` entry point to `/studio?demo=1`.
3. Confirm that no login is required, the persistent `DEMO` marker is visible, and confirmed saves are local-only.
4. Use the Model Context Tool Inspector or another WebMCP-capable client to discover the Studio tools.
5. Call `list_style_options`, `apply_preset`, and `apply_badge_style`. Confirm that each action appears in the terminal and re-renders the badge.
6. Call `save_badge_config`. Confirm that no save occurs until a human clicks **Confirm save**, then confirm that demo mode reports `(demo) configuration not persisted`.
7. Open `https://chapa.thecreativetoken.com/u/juan294`. **Let the page finish loading before you list tools.** This page registers its six tools after hydration, later than the Studio does, so a tool list requested immediately on navigation can come back empty. Wait for the score and badge to be visible, then call `get_impact_profile`, then `verify_badge`.
8. Call `get_embed_snippet`. Confirm that the returned Markdown matches the on-page embed snippet.
9. Open the verification URL returned by `verify_badge` in step 7. Change one hex character to confirm that an unknown code has no stored verification record.
10. ChatGPT in-app browser support is **untested**, not known to fail. Use the tested Chrome setup for judging.

### Juan-gated execution order

Do not reorder these actions. Do not perform any production or outward-facing action without Juan's explicit authorization at that execution step.

1. [x] **[JUAN GATE] Release to production:** done 2026-09-01 as **v2.28.0**. Production `/api/version` reports `4d8a6b70fb99336ccea84073582b8ef6a5026b85` in the `production` environment, the promoted tree matches the candidate tree, and all four `@release-required` production scenarios passed. Evidence: `quality/evidence/runs/release-203b06b3b80e/release-result.json` (`status: passed`), PR #1252, tag `v2.28.0`.
2. [x] **[JUAN GATE] Flip production flags without a deploy:** no flip was required. Verified 2026-09-01 that `webmcp_enabled`, `studio_demo_enabled` and `studio_enabled` were already enabled (since 2026-08-27), so no production write was made. Live tool list confirmed in flagged Chrome against production: **19 registrations across 18 distinct names** — `/` 2, `/studio?demo=1` 9, `/u/:handle` 6, `/verify/:hash` 2. Logged-out `/studio?demo=1` returns 200 with the `DEMO` marker and no login gate.
3. [x] **[JUAN GATE] Publish the repository:** done. <https://github.com/juan294/chapa> is public (`visibility: PUBLIC`), anonymous fetches of the repository page and raw `README.md` both return 200, and GitHub detects the root `LICENSE` as MIT (`spdx_id: MIT`), so it renders on the landing page. The Secret Scanning workflow is green on the current `develop` HEAD.
4. [ ] **[JUAN GATE] Record and upload the video:** record against the verified production release, keep it under three minutes, and upload it publicly to YouTube. `TODO_YOUTUBE_URL`
5. [ ] **[JUAN GATE] Submit on Devpost:** verify every URL and judge step, then submit. Target **September 2, 2026**. `TODO_DEVPOST_SUBMISSION_URL`
6. [ ] **Freeze after submission:** schedule nothing on `main` and make no repository, application, or Devpost changes until winners are announced, expected around **September 23, 2026**, except an explicitly authorized emergency response.

Hard deadline: **September 3, 2026 at 13:00 PT**. The September 2 target keeps a full buffer day.

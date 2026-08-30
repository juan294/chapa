# WebMCP Challenge — Portfolio Fit Analysis and Entry Recommendation

Date: 2026-08-26
Event: https://webmcp.devpost.com/
Status: Decision doc. No code written. Final recommendation: Chapa.

---

## 1. Event facts

All facts in this section are VERIFIED — fetched from the Devpost overview and
`/rules` pages on 2026-08-26.

| Item | Value |
| --- | --- |
| Submission window | 2026-08-25 11:00 PT — 2026-09-03 13:00 PT |
| Time remaining from today | ~8 days |
| Prize pool | $35,000 across **10 winners** (not 1st/2nd/3rd) |
| Per-winner cash | $3,000 (OpenAI) + $500 (Netlify) + credits (Cloudflare $10k, Vercel $3.6k + $600 gateway, Render $300) + Google AI Ultra 3mo + Shopify gear per member |
| Judging criteria | WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition — **equally weighted**, no percentages published |
| Sponsor tracks | None. Single winner cohort. |

### Hard gates (each one eliminates projects)

1. **Live URL, browser-reachable.** Must work in ChatGPT's in-app browser or
   Chrome with WebMCP enabled. Eliminates every CLI.
2. **Public repo with an OSS license file, prominently displayed.** Must contain
   the complete source and the working WebMCP tool-registration code.
3. **Free and unrestricted for judges.** Auth is allowed only if credentials are
   supplied in the submission form. Anything a judge can't exercise costs
   Execution points.
4. **Sole ownership.** "Original work product... solely owned by you, your Team,
   your Organization, with no other person or entity having any right or
   interest in it."
5. **Existing projects are allowed** — but only if "meaningfully extended using
   WebMCP after the Submission Period start date," with documentation
   distinguishing prior work from new work. This is favourable to us: the whole
   portfolio is fair game as long as the WebMCP layer is dated after 08-25.
6. Sub-3-minute YouTube demo video with audio.

### What WebMCP actually is

INFERRED from spec write-ups, not from a spec document I read end to end:
the page calls `document.modelContext.registerTool()` (formerly
`navigator.modelContext`, deprecated in Chromium 150) to declare tools with a
name, a natural-language description, a JSON Schema for inputs, and an `execute`
callback. HTTPS only. The tools run **in the page, in the user's existing
session** — which is the interesting part: the agent inherits the human's login
without a separate OAuth grant, and every tool call can visibly mutate the UI
the human is watching.

That property is the whole design brief. The winning entries will be the ones
where the human and the agent are looking at the *same screen* and the agent's
actions are legible, reversible, and human-gateable — not the ones where the
agent silently fills in a form.

The corollary cuts the other way too: **a WebMCP tool that merely wraps an
already-public REST endpoint demonstrates the syntax, not the point.** An agent
doesn't need `document.modelContext` to fetch public JSON — it can just call
the API. Leverage-scoring depth lives where WebMCP provides something the API
can't: session inheritance, shared live UI state, and human-gated writes.

**Execution risk to retire on day 1:** the API surface moved mid-2026
(`navigator.modelContext` → `document.modelContext`; old name deprecated in
Chromium 150), and the two judging clients — ChatGPT's in-app browser and
Chrome with WebMCP enabled — may differ in what they support. Before writing
any real tools, ship a hello-world tool and confirm it registers and is
callable in **both** clients (polyfill via `@mcp-b/global` if needed).
Discovering a client gap on day 7 is the one failure mode this plan cannot
absorb.

---

## 2. Portfolio sweep

Repo visibility, license, and description are VERIFIED via `gh repo view` on
2026-08-26.

| Project | Type | Repo | License | Verdict |
| --- | --- | --- | --- | --- |
| **chapa** | Next.js web app, live | PRIVATE | **MIT file present** | **Viable — final recommendation** |
| **paisaxe** | Next.js web app, live | PRIVATE | none | Viable, second |
| **clarity** | Next.js web app | PRIVATE | LICENSE file present | Viable, weak fit |
| **coach** | Next.js web app | PRIVATE | none | Blocked — health PII |
| **portfolio** | Next.js dashboard | PRIVATE | none | Viable, low impact |
| **archy** | Next.js dashboard (monorepo) | PRIVATE | none | Most creative, least testable |
| **spoken-letter** | Next.js web app | PRIVATE | none | **Blocked — code freeze** |
| **roots** | React + Vite web app | PUBLIC (`frivas/roots`) | none | **Blocked — ownership** |
| chapa-cli | CLI | PUBLIC | none | Out — not a web app |
| gh-glance | Terminal UI | PUBLIC | none | Out — not a web app |
| **summon** | CLI plus live static gallery | PUBLIC | **MIT** | **Viable — fallback** |
| termplex | CLI | PUBLIC | none | Out — not a web app |
| kalpha | stdio MCP server | PRIVATE | none | Out — not a web app |

### Elimination notes

- **Summon is the public-source exception.** Its main product is a CLI, but it already has a live GitHub Pages site and gallery from the public MIT repository. Workspace Forge still needs a browser editor, but it does not require a repository visibility change.
- **spoken-letter** is otherwise a strong candidate — it already has
  `src/app/api/mcp/route.ts` and `src/lib/chatgpt/mcp-server.ts` from the
  2026-08-25 ChatGPT Apps SDK plan. But that plan records a hard constraint:
  *no git push / PR until 2026-09-30, no production deploy until 2026-08-31*.
  The freeze is self-imposed, so Juan could lift it in principle — but it is
  almost certainly (INFERRED) the Gemini XPRIZE judging window, during which
  the submitted repo must stay frozen. Pushing a WebMCP layer during that
  window would risk the *other* hackathon's eligibility, and the freeze runs
  27 days past this one's deadline. Excluded.
- **roots** is public but lives under `frivas/`, and its description names the
  Community of Madrid. Fails the sole-ownership clause.
- **coach** holds encrypted genetic and lab-results PII. Open-sourcing it inside
  8 days, with judges poking a live instance, is not a risk worth $3,000.
- **kalpha** is a real MCP server, but it is stdio — a different protocol
  surface entirely, and there is no web app to attach tools to.

---

## 3. Idea 1 — Chapa: co-design your credential with your agent, and let other agents verify it (RECOMMENDED)

### Why Chapa

Chapa already is, structurally, a WebMCP app that hasn't registered its tools yet.

VERIFIED on 2026-08-26 by live HTTP and by reading the repo:

- `https://chapa.thecreativetoken.com/` and `/llms.txt` return 200. The live `/studio` route currently redirects to `/` because Studio is disabled.
- `GET /api/profile/juan294` → 200, returning
  `{"handle":"juan294","dimensions":{"delivery":100,"quality":79,"consistency":65,"breadth":71,"craft":83},"compositeScore":80,"archetype":"Builder","tier":"High",...}` —
  a clean, public, no-auth, structured profile. This is a tool response already.
- The repo ships an MIT `LICENSE` at root and an `app/.well-known` directory —
  it is *already* built to be machine-legible.
- `apps/web/app/studio/` contains `useStudioCommands.ts`, backed by
  `components/terminal/command-registry` with a `CommandDef` type. **There is
  already a command abstraction driving the Studio.** Human clicks in
  `QuickControls` and typed terminal commands both flow through it.
- `apps/web/app/studio/studio-options.ts` defines `STUDIO_CATEGORIES` — 9
  categories (Background, Card Style, Border, Score Effect, Heatmap Animation,
  Interaction, Stats Display, Tier Treatment, Celebration), each with labelled,
  *described* options ("Aurora Glow — animated color waves", "Gold Leaf —
  metallic gold leaf texture"). Those descriptions are, verbatim, the natural
  language an agent needs to choose between them.
- Badge authenticity is already HMAC-SHA256 signed with a public
  `/api/verify/[hash]` route.

So the build is: register `document.modelContext` tools that call the command
registry and the existing public APIs. One new adapter layer, no new backend.

### The concept

Three audiences share one page, and each gets a different tool set. The lead
act is the Studio; verification is the second act and the memorable close.

**A. LEAD — The developer, in the Studio, with their agent as art director and
coach.** This is where the WebMCP Leverage actually lives, because it is the
flow only WebMCP makes possible: the agent operates **inside the human's
existing authenticated session**, no API key and no OAuth grant, while the
human watches the same screen. They open `/studio` and tell their agent "make
it feel like molten metal, and tell me honestly what's dragging my score
down." The agent calls `list_style_options`, then `apply_badge_style` several
times — the badge visibly re-renders between calls. The human says "no, keep
the border but lose the confetti," and the agent adjusts. `simulate_score` and
`suggest_improvements` then turn it into a career conversation grounded in the
developer's real 12-month GitHub data. The save is human-gated: the agent can
propose, only the human commits.

**B. SECOND ACT — The recruiter's agent, on a public profile page, reading a
verifiable claim.** The narrative differentiator, with an honest caveat: these
tools wrap endpoints that are already public REST (`/api/profile/[handle]`,
`/api/verify/[hash]`), so on their own they are *thin* WebMCP leverage — an
agent could fetch the JSON without WebMCP at all. Their value is (a) discovery
— an agent landing on the page finds `get_impact_profile`, `get_impact_history`
and `verify_badge` declared in place, with schemas, instead of reverse-
engineering an API — and (b) the story: `verify_badge` returns the HMAC check
proving the numbers weren't fabricated, which reframes the submission as **a
trust layer for agent-readable claims about humans**. As hiring becomes
agent-mediated, "can an agent tell a real credential from a fabricated one?"
is the actual problem, and Chapa already has the cryptography. Lead with A in
the write-up and demo; close with B. Don't invert them — a judge who notices
the public-API duplication first will discount the whole entry.

**C. The badge itself becomes an agent-legible artifact** wherever it's embedded.

### Tool surface (concrete)

Registered on `/studio` — the human's existing session (or demo mode), the
leverage core:

| Tool | Backed by | Notes |
| --- | --- | --- |
| `list_style_options` | `STUDIO_CATEGORIES` | ships its own descriptions; zero prompt engineering needed |
| `apply_badge_style` | `useStudioCommands` / `CommandDef` | mutates the live preview, visible instantly |
| `preview_badge` | current config + `/u/:handle/badge.svg` | returns structured config *and* the rendered SVG URL |
| `save_badge_config` | `POST /api/studio/config` | **human-gated** — requires an on-page confirm |
| `reset_badge_config` | command registry | makes agent experimentation safely reversible |
| `simulate_score` | shared scoring package | "what if Quality were 90?" — pure function, no writes |
| `suggest_improvements` | scoring + dimension metadata | grounded coaching, not generic advice |

Registered on `/u/[handle]` and `/verify` — public, no auth (discovery + trust
story; thin leverage on their own, see concept B):

| Tool | Backed by | Notes |
| --- | --- | --- |
| `get_impact_profile` | `/api/profile/[handle]` | dimensions, archetype, composite, tier, confidence |
| `get_impact_history` | `/api/history/[handle]` | trend over time |
| `verify_badge` | `/api/verify/[hash]` | HMAC-SHA256 authenticity check — the trust story |
| `explain_dimension` | static + shared package | how Delivery/Quality/Consistency/Breadth/Craft are computed |
| `compare_profiles` | fan-out over profile API | the screening use case, opt-in on public handles only |

### How this scores against the four criteria

- **WebMCP Leverage.** Strong — but the depth claim rests entirely on the
  Studio side, and the write-up must say so. What scores: session inheritance
  as the reason write tools need no API key; route-conditional registration
  (three tool sets on three routes); a human-gated write; tools returning
  structured JSON *and* a visible UI mutation; and one command registry driven
  by three callers — clicks, the terminal, and the agent. That last point is a
  concrete architectural claim a judge can verify by reading one file. What
  does *not* score: the public read tools, which duplicate open REST endpoints
  and would be shallow leverage if presented as the core.
- **Execution.** The best in the portfolio by a distance. The app is live,
  tested, has 200-responding public APIs, and the command layer already exists.
  Eight days is comfortable rather than heroic.
- **Potential Impact.** Real and topical: verifiable credentials for a hiring
  process that is rapidly becoming agent-mediated.
- **Creativity & Ambition.** Above average. The read-and-verify direction is
  contrarian — most entries will demo an agent booking, buying, or filling in
  something.
- **Judge testability.** The decisive practical advantage. A judge can point
  their agent at any public handle and get real data with no signup. The Studio
  half normally needs a GitHub login — do NOT solve this with a throwaway
  account in the submission form. A fresh GitHub account hit from ten judges'
  locations will get flagged, and OAuth inside ChatGPT's in-app browser is
  exactly where flows break during judging. Instead build a feature-flagged
  **demo mode** (`/studio?demo=1`): anonymous session on a sandbox handle,
  full tool surface, writes land in a scratch config. Roughly a day of work,
  and it removes the single most likely way judges fail to see the lead act.

### Demo video shape (under 3 min)

Lead with the collaboration, close with the trust story. 0:00–0:20 the setup:
your badge, your agent, one screen. 0:20–1:30 in `/studio`, the agent
redesigns the badge conversationally — visible re-renders between tool calls —
while the human interrupts and redirects, ending with the human (not the
agent) clicking Save on the gated write. 1:30–2:20 the second act: a
recruiter's agent on the public profile calls `get_impact_profile` then
`verify_badge`; show the signature check pass, then fail on a tampered hash.
2:20–2:50 one screen on the architecture: one command registry, three drivers
(clicks, terminal, agent), session inherited, writes human-gated.

---

## 4. Idea 2 — Paisaxe: the itinerary the agent builds and you edit

VERIFIED: `paisaxe/src/app/api/mcp/` already contains `places`, `weather`,
`save-favorite`, and `make-booking` (with a `status` polling sub-route), each
with tests, plus `src/lib/mcp-auth.ts`. The tool vocabulary is designed and
shipped; only the browser-side registration is missing. Paisaxe also has
pgvector RAG and ElevenLabs voice.

**Concept.** The visitor talks to their own agent while the Paisaxe map and
itinerary panel update live. The agent calls `search_places`, `check_weather`,
`add_to_itinerary`, `reorder_day`; the human drags a stop, and the agent sees
the changed state on its next call. Voice plus agent plus map is a genuinely
pretty demo, and Asturias content is distinctive.

**Why it's second.**
- Travel planning is the single most obvious WebMCP demo. Expect heavy
  duplication in the judging pool; Creativity suffers.
- `make-booking` touches Stripe. Letting judges exercise a booking flow means
  either a sandbox carve-out or a tool that stops short of payment — extra work,
  or a weaker demo.
- No license file, and the repo is commercial (paisaxe.es / paisaxe.com,
  Stripe-connected). Open-sourcing it is a bigger business decision than
  open-sourcing Chapa.

Keep this one in the back pocket: if the Chapa repo fails a secret-history
audit, Paisaxe is the fallback with the shortest path to a tool surface.

---

## 5. Idea 3 — Archy: the fleet console an agent can actually operate

**Concept.** The most creative idea available, and I want it on the record. Archy
is an agent-ops dashboard: six scheduled agents, reports in `docs/agents/`, a
triage workflow, cost tracking, CI health across 13 projects. A WebMCP layer
would let a browser agent *operate the console* — `list_failing_projects`,
`read_agent_report`, `explain_incident`, `propose_fix`, `open_issue` — with the
dashboard rendering each finding and every mutating action gated behind a human
approval control on the page.

That is a sharp thesis: **the human-agent collaboration surface for supervising
other agents.** It is the most novel framing in this document and would score
highest on Creativity & Ambition.

**Why it isn't the pick.** It fails the gates that matter.
- The data is Juan's private fleet: infrastructure state, cost figures,
  incident history, secret-provisioning notes. Publishing the repo publishes all
  of it.
- A judge with no projects sees an empty console. Salvaging that means building
  a synthetic demo fleet — days of work that adds nothing to the product.
- Execution risk is the highest of the three and the calendar is the tightest.

If a future hackathon has a longer runway, this is the one to build.

## 5b. Also considered

- **Clarity** — agent co-builds a career learning path with the human approving
  each module. Coherent, but "AI builds you a learning plan" is a crowded
  category and the WebMCP layer adds little the chat interface doesn't already
  do. Weak on Creativity.
- **Portfolio** — already has voice and `portfolio_knowledge_search`, so tool
  registration is nearly free. But it is a personal metrics dashboard; Potential
  Impact scores near zero.

---

## 6. Idea 4: Summon Workspace Forge

### One-sentence pitch

Design a real multi-agent Ghostty workspace with an agent on a shared visual canvas, validate it together, and export the exact `.summon` configuration that launches it.

### What exists and what is new

Summon is already a published CLI with a public MIT repository, a live GitHub Pages site, a layout gallery, an interactive terminal layout builder, seven grid templates, a tree DSL, layout validation, command-safety checks, and saved configuration. Its pure modules include the gallery data, tree parser, layout planner, validation, and command specification. The current browser site is a static gallery. It is not yet the editor described here.

The hackathon work is a browser-native layout canvas plus WebMCP tools. The page lets the person and agent edit the same pane tree. It reuses Summon's existing model and export format, but it does not execute shell commands. The output is a `.summon` file for the existing CLI.

### Human-agent loop

1. The user opens Workspace Forge and asks for a four-pane workspace with two coding agents, a development server, and logs.
2. The agent inspects the current layout, selects a template, splits panes, assigns labels and commands, and adjusts proportions.
3. Each tool call changes the visible canvas. The user can drag a divider, rename a pane, or replace a command directly.
4. The agent reads the changed state, validates the tree, and explains any unsafe or incomplete command.
5. The user exports the validated `.summon` file and can launch it with the existing CLI.

### Focused tool surface

| Tool | Purpose | Side effect |
| --- | --- | --- |
| `inspect_workspace_layout` | Return pane names, commands, split tree, sizes, and validation state | Read-only |
| `apply_workspace_template` | Start from a built-in or gallery template | Changes the browser draft |
| `split_workspace_pane` | Split one pane right or down and name the new pane | Changes the browser draft |
| `configure_workspace_pane` | Set a pane label and bounded command string | Changes the browser draft |
| `resize_workspace_region` | Set a bounded proportion for a named split | Changes the browser draft |
| `validate_workspace_layout` | Parse the tree, find missing mappings, and flag shell metacharacters | Read-only |
| `export_summon_config` | Produce the final `.summon` text and a visible download | Creates a local download only |

Register `export_summon_config` only when validation passes. Mark inspect and validation tools as read-only. Treat command strings as untrusted content. The browser must never run them.

### Why it is a strong WebMCP entry

- **WebMCP Leverage:** This is exactly the shared-canvas case named in the [official OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp). The person and agent inspect and change the same spatial model, and every change is visible and reversible.
- **Execution:** The CLI, data model, templates, parser, validation rules, preview logic, and export format exist. The main new work is the browser editor and WebMCP adapter. This is more browser work than Chapa, but much less domain work than a new product.
- **Potential Impact:** Developers who operate several coding agents, servers, logs, and Git tools can turn a natural-language workspace request into a configuration that runs locally.
- **Creativity and Ambition:** It connects browser collaboration to a real local multi-agent workspace without giving the browser shell access. No current official WebMCP showcase entry uses this pattern.

### Three-minute demo

- **0:00–0:20:** Show a basic layout and the nested tree configuration that would otherwise be written by hand.
- **0:20–1:20:** Ask for a four-pane multi-agent workspace and show four or five WebMCP tools change the canvas.
- **1:20–1:50:** Drag a divider and rename a pane manually, then ask the agent to adapt to the new state.
- **1:50–2:20:** Insert an unsafe command and show validation reject it.
- **2:20–2:50:** Export the `.summon` file and show that the existing CLI accepts it.
- **2:50–3:00:** End on the running workspace and the still-editable browser canvas.

### Main risk

The current website is a static gallery, not a browser editor. The editor, WebMCP adapter, and browser tests must be built during the submission period. Potential Impact is also narrower than Chapa's hiring story. If Workspace Forge is used as the fallback, a day-one spike must prove that one pane can be created through WebMCP in both judging clients and exported through the existing Summon model.

---

## 7. Probability comparison: Chapa versus Summon

The event does not publish entry count or competitor quality, so absolute odds cannot be measured. The estimates below are planning judgments. They separate the chance of delivering an eligible, polished entry from the chance that a polished entry reaches the top ten.

| Factor | Chapa | Summon Workspace Forge | Edge |
| --- | ---: | ---: | --- |
| WebMCP Leverage | 8.5/10 | 9.5/10 | Summon: WebMCP is essential to the shared canvas; Chapa's Studio is strong, but its public verification tools duplicate REST APIs |
| Execution | 9.2/10 | 6.6/10 | Chapa: the live Next.js app, editor, command registry, scoring, APIs, and tests exist; Summon's browser editor is new |
| Potential Impact | 8.2/10 | 6.8/10 | Chapa: trusted developer credentials for agent-mediated hiring have a broader audience than macOS and Ghostty workspace design |
| Creativity and Ambition | 8.3/10 | 9.2/10 | Summon: a browser-to-local multi-agent workspace is more distinctive |
| Mean rubric score | **8.6/10** | **8.0/10** | Chapa |
| Estimated chance of an eligible, polished entry by the deadline | 88% | 68% | Chapa |
| Estimated top-ten chance if polished | 37% | 40% | Summon, narrowly |
| Rough overall win estimate | **33%** | **27%** | **Chapa** |

These estimates are deliberately conservative and are not contest statistics. Their useful result is the ordering, not the exact percentage.

### Why Chapa wins the probability comparison

Chapa's WebMCP adapter is new, but the product behind it is not. The live Next.js application, Creator Studio, command registry, scoring model, public profile APIs, HMAC verification, and tests already exist. A current `gitleaks` scan found no leaks across 1,548 commits, which reduces the public-repository risk. The Studio supplies the shared session, visible state changes, reversible edits, and human-gated save that make WebMCP necessary. The public verification flow then gives the demo a broader trust and hiring story.

The remaining work is controlled: enable or expose Studio for the judge path, add anonymous demo mode, register WebMCP tools over existing commands, publish a complete licensed source snapshot, and document the new work. The live `/studio` route currently redirects because Studio is disabled, but changing that is smaller than building a new browser editor.

### Why Summon loses despite stronger WebMCP leverage

Workspace Forge is more distinctive and is the cleaner WebMCP concept. It also has no authentication or publication gate. However, the current Summon builder is a TTY wizard and the live website is a static gallery. The browser canvas, interactive state model, module port, WebMCP adapter, export flow, visual polish, and browser tests are all new work inside eight days. Its audience is also narrower. Those Execution and Potential Impact disadvantages outweigh its lead in WebMCP Leverage and Creativity when the four criteria have equal weight.

---

## 8. Chapa delivery plan

**Enter Chapa.**

Chapa is the strongest candidate because it has the least code to write. `STUDIO_CATEGORIES` and the `CommandDef` registry are effectively a pre-built tool schema and dispatcher. The live app and public read APIs also reduce the demo risk. It does not clear every gate today: the repository is private, the Studio is disabled in production, and the collaborative flow needs an anonymous judge mode.

Chapa also has the best answer to the criterion most entries will fumble.
"WebMCP Leverage" rewards depth, and the honest depth story here is not "we
registered some tools" but "we had one command layer serving human clicks and a
terminal, and the agent became a third driver of the same layer, with
route-scoped tool sets and a human-gated write." That is a design claim, and it
happens to be true of the existing architecture.

Pitch order matters: the Studio collaboration is the thesis, `verify_badge` is
the close. The verify angle is what turns a good entry into a memorable one —
ten winners will be chosen, and the trust-layer framing is the thing most
likely to make Chapa one of them rather than the twentieth agent-fills-a-form
demo. But it cannot carry the leverage claim on its own, because its tools wrap
already-public REST; presented first, it invites the judge to conclude WebMCP
was unnecessary. Presented second, after the session-inherited co-design flow,
it reads as reach instead of padding.

### Blocking decision for Juan

**Chapa's repo must go public.** It is MIT-licensed already, so the license
question is settled — but:

- VERIFIED on 26 August: `gitleaks` scanned all 1,548 commits and reported no leaks. This lowers the publication risk, but it does not replace a manual check of business-sensitive code and deployment configuration.
- If publishing the full repository is unattractive, a fresh public repository can be seeded from a clean, complete tree. The rules require complete source, not complete history.

Everything else — the WebMCP layer, the demo, the write-up — is downstream of
that one yes/no.

### 8-day shape

| Day | Work |
| --- | --- |
| 1 | **Runtime spike first**: hello-world tool registered and callable in BOTH ChatGPT's in-app browser and Chrome-with-WebMCP (`document.modelContext`, `@mcp-b/global` polyfill if needed). In parallel: review business-sensitive source and decide the public-repository strategy. |
| 2 | Studio tools over the existing `CommandDef` registry (the lead act — build it first) |
| 3 | Human-gated `save_badge_config`; `reset` for reversible experimentation |
| 4 | `simulate_score` + `suggest_improvements` coaching pair |
| 5 | Judge-facing **demo mode** (`/studio?demo=1`, sandbox handle, scratch config) |
| 6 | Public read tools on `/u/[handle]` + `/verify`; route-conditional registration |
| 7 | Repo public; README with the prior-work/new-work split; demo video; submission write-up |
| 8 | Buffer. Deadline 09-03 13:00 PT |

Note the rules require documentation "distinguishing prior work from new work."
Chapa's advantage — an app that already exists — is also the thing that needs
the most careful framing. Put a dated section in the README stating plainly what
predates 2026-08-25 and what the WebMCP layer added, and cite commit dates.
Judges reward candour here; ambiguity reads as an attempt to pass off old work.

---

## 9. Summon contingency shape

| Day | Work |
| --- | --- |
| 1 | Build the smallest browser canvas and prove one WebMCP pane mutation in both judging clients. Confirm export through Summon's existing layout model. This is the switch-or-continue gate. |
| 2 | Add templates, pane splitting, labels, commands, resizing, and visible state history. |
| 3 | Register the focused WebMCP tool set with narrow schemas, read-only annotations, and route/state guards. |
| 4 | Add validation, unsafe-command warnings, reversible edits, and `.summon` export. |
| 5 | Polish the visual canvas, empty states, accessibility, errors, and unsupported-browser fallback. |
| 6 | Add automated WebMCP tests and prove that an exported candidate launches through the real Summon CLI. |
| 7 | Deploy the exact candidate, document old versus new work, record the demo, and draft the submission. |
| 8 | Buffer and exact-candidate verification before the deadline. |

---

## 10. Final recommendation

**Enter Chapa.**

Chapa has the highest probability of winning because it combines a strong shared-page WebMCP interaction with the best Execution and Potential Impact scores. Workspace Forge is likely to score higher on WebMCP Leverage and Creativity, but it requires a new browser product and serves a narrower audience. Chapa's clean history scan, existing editor, existing command abstraction, live APIs, verification path, and tests make a polished exact-candidate submission more likely within eight days.

Use Workspace Forge only if a complete licensed Chapa source snapshot cannot be made public immediately. If Chapa is selected, do not reopen the project comparison. Start with the two-client WebMCP runtime spike, then build the anonymous Studio demo path before the lower-value public read tools.

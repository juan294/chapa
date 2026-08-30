# WebMCP Challenge: Archy Project Fit and Entry Concepts

**Date:** 2026-08-26

**Event:** [The WebMCP Challenge](https://webmcp.devpost.com/)

**Decision question:** Which Archy-tracked project gives Juan the best chance of placing in the top ten?

## Conclusion

Enter with **Summon Workspace Forge**, a WebMCP-enabled visual workspace designer that lets a person and an agent build a Ghostty layout together, validate it, and export a working `.summon` file.

Summon is the best probability-adjusted choice. It has a public MIT repository, a live layout gallery, a published CLI, an existing visual layout builder, a tested tree DSL, and pure layout modules that can be reused in a browser. The new WebMCP work can therefore focus on the part the judges score: a rich shared-page tool surface and a complete human-agent experience. Summon's current visual builder already supports a template gallery, grid sculpting, live preview, tree generation, and saved layouts (`/Users/juan/code/summon/docs/user-manual.md:252-272`). Its layout format already defines pane placement and commands through a small tree DSL (`/Users/juan/code/summon/docs/user-manual.md:471-510`).

The strongest alternative is **Paisaxe: A Day in Asturias, Together**. It has the better emotional demo and the richer real-world action loop, but the current repository is private and the outbound booking action needs a safe judge mode. It is also close to an official WebMCP showcase pattern: OpenAI already presents WanderNote as an editable trip-planning app. Paisaxe can still stand apart through immersive local stories and its last-mile voice call to a real business, but it has more compliance and execution risk.

If Juan is willing to publish a complete, licensed Paisaxe submission snapshot immediately and provide a safe booking sandbox, Paisaxe becomes the higher-upside choice. Without those two decisions, Summon has the higher chance of producing an eligible, polished, judge-proof entry by the deadline.

A live eligibility check on 26 August confirmed that Summon's main site and gallery both return HTTP 200, and its GitHub repository is public with an MIT license. Paisaxe's live site also returns HTTP 200, but its GitHub repository is private and GitHub detects no license. This does not disqualify Paisaxe if those conditions change before submission, but it makes Summon ready for the public-source rule today.

## Scope: What “Archy-tracked” Means

Archy's live Portfolio Watchdog configuration tracks 12 sibling projects: Chapa, Chapa CLI, Clarity, gh-glance, Paisaxe, Summon, Kalpha, Coach, Portfolio, Roots, Spoken Letter, and Termplex (`scripts/agent-config.json:19-37`). This research also includes Archy itself as the orchestrator.

The smaller morning-briefing and health-collector registry is not the complete product list. Its fallback contains Archy and seven siblings (`scripts/lib/project-registry.sh:9-42`). The nightly knowledge ingester is also not a curated product list: it discovers filesystem directories and applies an exclusion list (`packages/local/src/scanner/discover.ts:68-103`; `packages/local/src/commands/ingest-config.ts:66-79`). The Portfolio Watchdog set is therefore the correct comparison set for this decision.

## Event Rules That Change the Project Choice

The [Official Rules](https://webmcp.devpost.com/rules) govern the event. The separate schedule gives a start time that is one hour later than the Rules, so this document uses the Rules where the pages differ.

- Registration and submissions opened on 25 August 2026 at 11:00 PT.
- The deadline is 3 September 2026 at 13:00 PT, which is 22:00 CEST in Madrid.
- Judging runs from 4 September through 21 September. Winners are expected around 23 September.
- An individual, team, or organization can enter. An individual must be at least the age of majority where they live and reside in a supported country. Spain is supported.
- The project must be a WebMCP-powered web app where people and agents interact, collaborate, or create together.
- Existing products are allowed, but only meaningful WebMCP work added after the submission period began is judged. The entry must clearly separate old work from new work with dated commits or equivalent evidence.
- The submission needs a working live URL, an English description, a public YouTube demo with audio under three minutes, and a public GitHub, GitLab, or Bitbucket repository.
- The public repository must contain the source, assets, and instructions needed to run the project. It must also have a visible open-source license.
- Authentication is allowed if the judges receive credentials and clear test instructions. Access must remain free through judging.
- Judges can decide not to test the live app. They can judge only from the description, images, video, and repository.
- The Resources FAQ says not to modify the submitted app, repository, or Devpost entry after the deadline until winners are announced.

There is one prize category with ten equal winners. Each winner receives $3,000 from OpenAI, $500 from Netlify, a Codex Micro, one year of ChatGPT Pro for up to three team members, sponsor credits, and other sponsor prizes. There are no separate sponsor tracks to target. See the [prize section](https://webmcp.devpost.com/#prizes) and [Official Rules section 9](https://webmcp.devpost.com/rules).

## Judging Model

Stage one is pass/fail. The project must fit the theme and use WebMCP in a meaningful way.

Stage two uses four equally weighted criteria, so each is effectively 25%:

1. **WebMCP Leverage:** thorough, skillful, working, non-trivial use.
2. **Execution:** a complete and coherent runnable product, not only a proof of concept.
3. **Potential Impact:** a specific real problem for a real audience, with a solution shown in the demo.
4. **Creativity and Ambition:** a novel concept that differs from existing concepts.

Ties are broken first by WebMCP Leverage, then Execution, Potential Impact, and Creativity. This makes the WebMCP interaction design more important than a large feature list. See [Official Rules section 7](https://webmcp.devpost.com/rules).

## What Strong WebMCP Use Looks Like

WebMCP gives a website a page-local tool surface. The agent and person work with the same live page and signed-in session. This differs from a normal MCP server, which can work without an open page. OpenAI's current [Site tools guide](https://learn.chatgpt.com/docs/webmcp) says to reuse the application's existing logic and permissions, keep inputs narrow, describe side effects, return enough data to verify a result, and preserve the normal human interface.

For this event, the strongest implementation pattern is:

- The page has a useful visual state that both person and agent can inspect.
- The tools change that visible state, not only return hidden API data.
- Read tools and write tools are separate.
- Tools register only when they are useful in the current page state.
- Consequential writes show the exact proposed action and require confirmation.
- Tool outputs are short, typed, and sufficient to verify what changed.
- The app works normally when WebMCP is unavailable.

The current specification supports imperative tools through `document.modelContext.registerTool(...)`. The event rules show this API in the repository requirements. The [WebMCP specification](https://webmachinelearning.github.io/webmcp/) and [Chrome WebMCP guide](https://developer.chrome.com/docs/ai/webmcp) also describe declarative form tools, same-origin permissions, typed input schemas, and tool annotations. Chrome's [security guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools) recommends `readOnlyHint` for reads, `untrustedContentHint` for external or user-generated results, narrow origin exposure, and explicit user interaction for sensitive steps.

## Comparison Across All Projects

The ratings below are decision judgments, not measured product scores. “Rubric potential” describes the best plausible WebMCP extension. “Submission risk” includes public-source, ownership, safety, authentication, and build-scope concerns verified on 26 August 2026.

| Project | Best WebMCP use | Rubric potential | Submission risk | Decision |
| --- | --- | --- | --- | --- |
| **Archy** | A shared operations cockpit where an agent inspects project health, prepares actions, and sends exact proposals into the existing approval flow | Very high leverage and execution; strong impact | Very high: private source, private portfolio data, credentials, and consequential operations | Do not enter with it. A safe judge sandbox would become a second product. Archy already has a broad agent/tool architecture and scheduled project monitoring (`README.md:20-78`). |
| **Chapa** | Let an agent explain an impact profile, adjust Creator Studio effects, preview the badge, and produce verified embed snippets | High execution, visual clarity, and a simple three-minute demo | Medium-high: current repository is private, though the product has an MIT badge; impact is narrower | Strong backup. The current app already has public profiles, interactive score views, an authenticated Creator Studio, and badge verification (`/Users/juan/code/chapa/README.md:19-73`). |
| **Chapa CLI** | Use WebMCP only in the browser approval step for EMU contribution import | Low leverage as a standalone entry | Low source risk because it is public and MIT, but it is a CLI without a useful shared page | Fold any idea into Chapa. The CLI exists to bridge EMU activity into the web product (`/Users/juan/code/chapa-cli/README.md:10-35`). |
| **Clarity** | A person and agent refine career goals, reshape a visible learning roadmap, and mark progress together | Good usefulness and impact | High: private source, authenticated setup, and older README paths need runtime validation | Viable, but generic compared with the finalists. Its current product centers on personalized roadmaps, progress, and resource search (`/Users/juan/code/clarity/README.md:1-15`; `/Users/juan/code/clarity/README.md:93-123`). |
| **gh-glance** | A new web mirror where an agent filters actions, issues, pull requests, and security alerts | Low because it requires a new browser product | Medium: repository is public and MIT, but the concept conflicts with the product's “avoid switching to a browser” purpose | Exclude. gh-glance is intentionally a terminal dashboard (`/Users/juan/code/gh-glance/README.md:12-20`; `/Users/juan/code/gh-glance/README.md:57-74`). |
| **Paisaxe** | Build a visible Asturias trip board from the current story, local weather, places, favorites, and a confirmed booking call | Very high across all four criteria | High: private source, live third-party services, personal data, and an outward phone call | Finalist with higher upside and higher risk. Paisaxe already combines an immersive visual product with chat, voice, favorites, and real-time content (`/Users/juan/code/paisaxe/README.md:13-28`). |
| **Summon** | Co-design a visual Ghostty workspace, validate its layout and pane commands, then export a `.summon` file | Very high WebMCP leverage and creativity; good execution; moderate but specific impact | Low: public MIT repository, existing live gallery, no account or paid provider required | **Recommended.** Summon already has a layout gallery, custom tree layouts, live preview, and exportable configuration (`/Users/juan/code/summon/README.md:10-12`; `/Users/juan/code/summon/README.md:88-140`). |
| **Kalpha** | A browser research workbench where an agent extracts measurements while the scientist reviews source evidence and approves rows | Exceptional impact and creativity | High: current repository is private, and the existing browser pages are auth/admin rather than a scientist workbench | High-upside third choice, but too much new browser product work for this event. Kalpha's mature 15-tool MCP pipeline already covers search, extraction, citations, statistics, and plots (`/Users/juan/code/kalpha/README.md:7-41`). |
| **Coach** | Replan a visible training week with the agent after missed sessions, while the user reviews and confirms each change | Very high leverage, execution, and usefulness | High: private source, health data, multi-tenant auth, and sensitive writes make judge access difficult | Strong product fit, weak short-event fit. Coach already has voice-driven plan changes that update the UI without reload (`/Users/juan/code/coach/README.md:24-45`). |
| **Portfolio** | Let a recruiter ask an agent to compare projects, open evidence, and build a shareable interview trail | High execution and low action risk | High: private source; the audience and impact are narrow; the current voice guide already covers part of the value | Good fallback, but less novel. The live dashboard already exposes project evidence, artifacts, metrics, and a context-aware voice guide (`/Users/juan/code/portfolio/README.md:18-30`). |
| **Roots** | Let a parent and agent shape a visual learning or storytelling session together | High creative potential | Very high: Juan is a contributor, not the sole owner; child-facing safety and broad product scope add risk | Exclude unless the owner joins the team and narrows the entry. Roots covers tutoring, storytelling, voice, and generated illustrations (`/Users/juan/code/roots/README.md:10-36`). |
| **Spoken Letter** | Let an adult and agent shape a family story draft in the authenticated creation page while recording and sending remain explicit human steps | Exceptional emotional impact, execution, and WebMCP fit | Blocking: current remote/GitHub mutation freeze runs through 30 September 2026, while this event requires a public repository and live submission | Do not use for this event. The product's core workflow and safety model are strong (`/Users/juan/code/spoken-letter/README.md:28-45`; `/Users/juan/code/spoken-letter/README.md:73-81`), but its current local-only rule forbids remote mutation (`/Users/juan/code/spoken-letter/docs/agents/shared-context.md:1388-1404`). |
| **Termplex** | A new browser layout builder that exports `.termplex` configuration | Low because the web product would be new and duplicate the stronger Summon path | Low source risk because it is public and MIT, but high product-scope risk | Exclude in favor of Summon. Termplex is a smaller tmux CLI with preset and file configuration (`/Users/juan/code/termplex/README.md:8-24`; `/Users/juan/code/termplex/README.md:43-80`). |

## Idea 1: Summon Workspace Forge

### One-sentence pitch

Design a real multi-agent Ghostty workspace with an agent on a shared visual canvas, then export the exact `.summon` layout that launches it.

### Real problem and audience

Developers using several coding agents, a shell, logs, and Git tools must translate a mental layout into nested splits, pane commands, and sizing rules. Summon already solves execution on macOS and already has a visual terminal builder. WebMCP makes the browser design surface directly usable by the agent while the developer stays in control.

### Human-agent loop

1. The user opens the existing Summon layout gallery and starts a new workspace.
2. The user asks: “Make me a four-pane Next.js workspace with two coding agents, a dev server, and gh-glance. Give the agents 70% of the width and keep logs below the server.”
3. The agent inspects the current canvas, selects or creates a layout, splits panes, assigns commands, and adjusts proportions.
4. Each tool call updates the visible diagram. The user can drag a divider, rename a pane, or replace a command directly.
5. The agent reads the new state, catches a missing pane name or unsafe command, and proposes a correction.
6. The user accepts the final design and exports a `.summon` file with the tree expression and pane definitions.
7. The page shows the exact local command to launch it. The browser never executes shell commands.

### Focused tool set

| Tool | Purpose | Side effect |
| --- | --- | --- |
| `inspect_workspace_layout` | Return pane names, commands, split tree, sizes, and validation state | Read-only |
| `apply_workspace_template` | Start from `full`, `pair`, `minimal`, `cli`, or a gallery template | Changes only the browser draft |
| `split_workspace_pane` | Split one pane right or down and name the new pane | Changes only the browser draft |
| `configure_workspace_pane` | Set a pane label and command with strict length and character validation | Changes only the browser draft |
| `resize_workspace_region` | Set a bounded proportion for a named split | Changes only the browser draft |
| `validate_workspace_layout` | Parse the tree, find missing pane mappings, and flag shell metacharacters | Read-only |
| `export_summon_config` | Produce the final `.summon` text and trigger a visible download-ready result | Creates a local download only |

Register `export_summon_config` only when the layout validates. Mark the inspect and validate tools with `readOnlyHint`. Keep command strings as untrusted user content and never execute them in the browser. Reuse Summon's existing command-analysis and trust patterns; its current local runtime already prompts before commands containing shell metacharacters and refuses them in non-interactive contexts (`/Users/juan/code/summon/README.md:278`).

### Why it scores well

- **WebMCP Leverage:** The agent uses several typed, stateful tools and works on the same visual object as the person. The browser UI visibly proves every change.
- **Execution:** The CLI, layout rules, preview logic, templates, export format, tests, live gallery, and public repository already exist. The hackathon work can be a coherent extension rather than a fresh backend.
- **Potential Impact:** It removes setup friction for developers who use multi-agent terminal workspaces. The output is not a mock object; it is the configuration consumed by the published CLI.
- **Creativity and Ambition:** None of the current official WebMCP showcase entries is a terminal-workspace designer. The page connects agent collaboration in the browser to an executable local workspace without giving the browser shell access.

### Three-minute demo

- **0:00-0:20:** Show the blank or basic layout and the hard-to-write tree configuration.
- **0:20-1:25:** Ask for a multi-agent workspace. Show the agent call four or five WebMCP tools while the canvas changes.
- **1:25-1:55:** Drag one divider and rename a pane manually. Ask the agent to adapt to the new state.
- **1:55-2:25:** Insert an unsafe command, show validation catch it, and replace it with a safe command.
- **2:25-2:50:** Export the `.summon` file and show its tree and pane mappings.
- **2:50-3:00:** End on the exact launch command and the unchanged human-editable canvas.

### Main risk

Potential Impact is the weakest of the four criteria because the audience is narrower than travelers or scientists. The submission must name the audience precisely and show that the exported file works with the real CLI. Do not describe it as a generic layout toy.

## Idea 2: Paisaxe: A Day in Asturias, Together

### One-sentence pitch

Turn the Asturias story currently on screen into a weather-aware, editable day plan that the visitor and agent refine together, then let the agent place a confirmed booking call to one local business.

### Real problem and audience

Travelers move between inspiration, official information, weather, place search, favorites, itinerary notes, and phone calls. Small Asturian businesses often still complete bookings by phone. Paisaxe already combines curated tourism stories, contextual chat, voice guidance, live place and weather lookup, favorites, and a call-based booking path.

The current domain actions are substantial. Paisaxe has MCP-shaped endpoints for place search, weather, outbound booking, booking status, and save-favorite (`/Users/juan/code/paisaxe/docs/project/features.md:125-136`). The booking route uses ElevenLabs and Twilio to call a business and conduct the conversation (`/Users/juan/code/paisaxe/src/app/api/mcp/make-booking/route.ts:33-56`). Its current agent rules already require all fields, user confirmation, tool-result truthfulness, and a clear distinction between “call placed” and “reservation confirmed” (`/Users/juan/code/paisaxe/docs/operations/pelayo-guide-system-prompt.md:133-174`).

### Human-agent loop

1. The user opens an immersive story, for example Cudillero or Picos de Europa.
2. The user asks for a day plan with constraints such as rain, a child-friendly lunch, no car after dinner, and one local food experience.
3. The agent reads the visible story context, checks the weather, finds places, and adds stops to a visible trip board.
4. The user pins one stop, removes another, or changes the available time directly in the page.
5. The agent reads the updated board and rebalances the route.
6. For one venue, the agent prepares an exact booking request. The page shows venue, date, time, party size, name, and phone number.
7. The user confirms. Only then does the booking-call tool become available.
8. The trip board reports “call placed,” “confirmed,” “failed,” or “manual call needed” from the actual booking status. It never reports a confirmed reservation before the status proves it.

### Focused tool set

| Tool | Purpose | Side effect |
| --- | --- | --- |
| `get_visible_asturias_story` | Return the current story, location, and visible visitor constraints | Read-only |
| `search_asturias_places` | Find bounded place results for the current trip context | Read-only; external content is untrusted |
| `get_asturias_weather` | Return current weather for one bounded place/date | Read-only |
| `update_trip_board` | Add, remove, pin, or reorder one stop and update the visible board | Changes the browser draft |
| `save_trip_favorite` | Save one selected place for the signed-in visitor | Account write |
| `prepare_booking_call` | Validate and display the exact proposed call without placing it | Read-only |
| `place_booking_call` | Place one allowlisted, confirmed call with an idempotency key | Consequential write; explicit confirmation |
| `check_booking_status` | Return the current real status and visible recovery action | Read-only |

Register `place_booking_call` only after `prepare_booking_call` has a complete, user-confirmed payload. Use a judge sandbox that calls an allowlisted test destination and behaves exactly like the production state machine. Do not let judges place arbitrary calls.

### Why it scores well

- **WebMCP Leverage:** It combines page state, external reads, visible draft writes, account writes, a confirmed outward action, dynamic tool registration, idempotency, and verifiable status.
- **Execution:** The core product, visual stories, chat, voice, place search, weather lookup, favorites, booking call, status handling, and tests already exist.
- **Potential Impact:** The audience and problem are easy to explain. The workflow connects visitors with local places and small businesses.
- **Creativity and Ambition:** The immersive story becomes a shared trip board, and the last mile is a real multilingual phone call rather than another booking-form wrapper.

### Three-minute demo

- **0:00-0:20:** Open an Asturias story and state the travel constraints.
- **0:20-1:15:** Let the agent inspect the story, check weather, search places, and build the visible day plan.
- **1:15-1:40:** Change one stop manually and show the agent adapt to the same page state.
- **1:40-2:15:** Prepare the booking request, show exact details, and confirm it.
- **2:15-2:40:** Place the judge-sandbox call and show the truthful intermediate status.
- **2:40-2:55:** Show the final status or recovery action and the updated trip board.
- **2:55-3:00:** End on “one page, one shared plan, one verified action.”

### Main risks

1. The official WebMCP showcase already includes an editable trip planner, so the entry must lead with the local-business phone call and immersive story context, not generic itinerary generation.
2. The current repository is private. A thin public WebMCP wrapper around a private application may not satisfy the requirement that the public repository contain everything needed for the project to function.
3. The live call is outward-facing and can cost money or disturb a business. The judge path needs a controlled destination, rate limit, idempotency, and truthful status.
4. Authentication, Google Places, weather, ElevenLabs, Twilio, and persistence create more failure points than Summon.

## Why the Other High-Potential Projects Did Not Win the Recommendation

- **Kalpha** has the strongest mission and the most mature MCP foundation, but that is also the conceptual trap. The judges are scoring WebMCP, not remote MCP. A winning Kalpha entry needs a new scientist-facing shared browser workbench, not a wrapper around the existing 15 tools. That is too much new product surface for this deadline.
- **Coach** already has a powerful state-changing agent and a complete web product, but judge credentials would expose a sensitive health-data workflow. A realistic sandbox must cover auth, plans, health context, and writes. This is possible, but it spends the short event on test-fixture work rather than visible WebMCP leverage.
- **Chapa** is the safest private web-product alternative. Its Creator Studio and verified output are easy to show, but changing badge effects has a weaker real-world problem than the two finalists.
- **Archy** would demonstrate the deepest tool and approval architecture, but a faithful judge environment would either expose private operations or reduce the idea to a mock dashboard.
- **Spoken Letter** would be emotionally strong, but its current local-only remote freeze and this event's public-repository requirement are incompatible during the submission window.

## Entry Decision Gate

Choose **Summon Workspace Forge** unless all of these Paisaxe conditions are accepted by 27 August:

1. Publish a complete, functional, licensed source snapshot for the submission.
2. Build a judge-safe booking sandbox with an allowlisted destination.
3. Keep the new work narrow enough to freeze a tested candidate before 3 September.
4. Make the demo about the shared page and truthful action state, not about the existing voice agent.

If any condition is not accepted, do not spend another day comparing ideas. Build Summon.

## Submission Checklist for Either Idea

- Create a dated commit boundary that proves all WebMCP work happened after the submission period opened.
- Add a README section named `Pre-existing work vs. hackathon work`.
- Put the tool inventory, annotations, confirmation behavior, and test prompts near the top of the README.
- Verify the public repository and visible license from a signed-out browser.
- Verify the live URL in ChatGPT's in-app browser and Chrome with WebMCP enabled.
- Add automated tests for tool registration, schemas, state updates, errors, and unsupported-browser fallback.
- Run WebMCP evals against the exact prompts used in the video.
- Record a public YouTube demo under three minutes with audio.
- Keep the deployed SHA, repository SHA, video, screenshots, and Devpost claims aligned.
- Freeze the submitted app and repository after the deadline until winners are announced.

## Sources

### Event and WebMCP

- [The WebMCP Challenge overview](https://webmcp.devpost.com/)
- [Official Rules](https://webmcp.devpost.com/rules)
- [Schedule](https://webmcp.devpost.com/details/dates)
- [Resources and FAQ](https://webmcp.devpost.com/resources)
- [OpenAI Site tools guide](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI WebMCP showcase](https://developers.openai.com/showcase?view=webmcp-apps)
- [WebMCP specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP developer guide](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)

### Local project evidence

- Archy tracking source: `scripts/agent-config.json:19-37`
- Archy purpose and architecture: `README.md:1-78`
- Chapa: `/Users/juan/code/chapa/README.md:19-73`
- Chapa CLI: `/Users/juan/code/chapa-cli/README.md:10-81`
- Clarity: `/Users/juan/code/clarity/README.md:1-15`, `/Users/juan/code/clarity/README.md:93-123`
- gh-glance: `/Users/juan/code/gh-glance/README.md:12-20`, `/Users/juan/code/gh-glance/README.md:57-74`
- Paisaxe: `/Users/juan/code/paisaxe/README.md:13-47`, `/Users/juan/code/paisaxe/docs/project/features.md:125-136`, `/Users/juan/code/paisaxe/src/app/api/mcp/make-booking/route.ts:33-56`
- Summon: `/Users/juan/code/summon/README.md:10-12`, `/Users/juan/code/summon/README.md:88-140`, `/Users/juan/code/summon/docs/user-manual.md:252-272`, `/Users/juan/code/summon/docs/user-manual.md:471-510`
- Kalpha: `/Users/juan/code/kalpha/README.md:7-67`
- Coach: `/Users/juan/code/coach/README.md:24-45`, `/Users/juan/code/coach/README.md:100-134`
- Portfolio: `/Users/juan/code/portfolio/README.md:18-30`
- Roots: `/Users/juan/code/roots/README.md:10-36`
- Spoken Letter: `/Users/juan/code/spoken-letter/README.md:28-45`, `/Users/juan/code/spoken-letter/README.md:73-92`, `/Users/juan/code/spoken-letter/docs/agents/shared-context.md:1388-1404`
- Termplex: `/Users/juan/code/termplex/README.md:8-24`, `/Users/juan/code/termplex/README.md:43-80`

## Research Boundary

This document compares the current event rules and current local project state. It does not authorize repository publication, remote changes, deployment, registration, submission, outbound calls, or other production-affecting actions.

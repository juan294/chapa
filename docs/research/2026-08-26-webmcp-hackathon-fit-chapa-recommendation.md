# WebMCP Challenge — Fit Analysis and Chapa Recommendation (Opus session)

Date: 2026-08-26
Event: https://webmcp.devpost.com/
Status: Decision doc. No code written. Companion/counterpoint to
`2026-08-26-webmcp-hackathon-project-fit.md` (a parallel session's analysis,
which recommends Summon) — see section 7 for the reconciliation. Awaiting
Juan's decision.

---

## 1. Event facts

VERIFIED — fetched from the Devpost overview and `/rules` on 2026-08-26.

| Item | Value |
| --- | --- |
| Submission window | 2026-08-25 11:00 PT — 2026-09-03 13:00 PT (~8 days left) |
| Prize pool | $35,000 across **10 equal winners** |
| Per-winner | $3,000 (OpenAI) + $500 (Netlify) + credits (Cloudflare $10k, Vercel $3.6k + $600 gateway, Render $300) + Google AI Ultra 3mo + Shopify gear; Codex Micro + 1yr ChatGPT Pro (per the parallel doc's reading of the prize section) |
| Judging criteria | WebMCP Leverage, Execution, Potential Impact, Creativity & Ambition — equally weighted; **ties broken by WebMCP Leverage first** (parallel doc, Rules §7) |
| Sponsor tracks | None. Single winner cohort. |

### Hard gates

1. **Live URL, browser-reachable** (ChatGPT in-app browser or Chrome with
   WebMCP enabled). Eliminates pure CLIs.
2. **Public repo, OSS license prominently displayed**, complete source +
   working WebMCP tool-registration code.
3. **Free and unrestricted for judges**; auth allowed only with credentials in
   the submission form. NOTE (adopted from the parallel doc): judges **may
   decline to test the live app** and judge only from the description, video,
   images, and repository — so the video and README carry more weight than I
   originally assumed, and live-testability is an edge, not a guarantee.
4. **Sole ownership** of the work product.
5. **Existing projects allowed** if meaningfully extended with WebMCP after
   2026-08-25, with dated documentation separating prior from new work.
6. Sub-3-minute public YouTube demo with audio.
7. Post-deadline freeze: do not modify the app, repo, or Devpost entry between
   the deadline and winner announcement (~Sep 23).

### What WebMCP is, and where leverage lives

The page registers tools via `document.modelContext.registerTool()` (formerly
`navigator.modelContext`, deprecated in Chromium 150): name, description, JSON
Schema inputs, `execute` callback. HTTPS only. Tools run **in the page, in the
user's existing session** — the agent inherits the human's login with no OAuth
grant, and tool calls can visibly mutate the UI the human is watching.
Chrome's security guide adds `readOnlyHint` / `untrustedContentHint`
annotations and narrow-origin exposure (adopted from the parallel doc's spec
reading — use these in the implementation).

Corollary: **a WebMCP tool that merely wraps an already-public REST endpoint
demonstrates the syntax, not the point** — an agent can just fetch the JSON.
Depth lives where WebMCP provides what an API can't: session inheritance,
shared live UI state, human-gated writes.

**Execution risk to retire on day 1:** the API surface moved mid-2026 and the
two judging clients (ChatGPT in-app browser; Chrome with WebMCP enabled) may
differ. Ship a hello-world tool and confirm it registers and is callable in
BOTH clients (polyfill `@mcp-b/global` if needed) before writing real tools.

---

## 2. Portfolio sweep

Repo visibility/license VERIFIED via `gh repo view` + local trees, 2026-08-26.

| Project | Type | Repo | License | Verdict |
| --- | --- | --- | --- | --- |
| **chapa** | Next.js web app, live | PRIVATE | MIT file in tree | **Top pick** |
| **paisaxe** | Next.js web app, live | PRIVATE | none | Viable, high-upside/high-risk |
| **summon** | CLI + static gallery site | **PUBLIC** | **MIT file in tree** (GitHub API shows "none" — detection, not absence) | Eligible today, but the web app is greenfield (see §7) |
| **clarity** | Next.js web app | PRIVATE | LICENSE present | Viable, weak fit |
| **coach** | Next.js web app | PRIVATE | none | Blocked — health PII |
| **portfolio** | Next.js dashboard | PRIVATE | none | Viable, low impact |
| **archy** | Next.js dashboard | PRIVATE | none | Most creative, least testable |
| **spoken-letter** | Next.js web app | PRIVATE | none | Blocked — freeze (likely Gemini judging window, INFERRED) through 09-30 |
| **roots** | React + Vite web app | PUBLIC (`frivas/roots`) | none | Blocked — sole ownership |
| chapa-cli / gh-glance / termplex | CLI / TUI | PUBLIC | none | Out — no web surface |
| kalpha | stdio MCP server | PRIVATE | none | Out — no web surface |

CORRECTION to my earlier summary: I previously wrote "any entry requires
flipping one repo public." That was wrong on two counts: summon is already
public with an MIT license file, and a **new** app built during the window
needs no flip at all. The repo-flip decision applies only to entering an
existing private web app (chapa, paisaxe).

---

## 3. Recommended: Chapa — co-design your credential with your agent, and let other agents verify it

### Why Chapa

Chapa is, structurally, a WebMCP app that hasn't registered its tools yet.
VERIFIED 2026-08-26 by live HTTP and reading the repo:

- `https://chapa.thecreativetoken.com/`, `/studio`, `/llms.txt` all 200.
- `GET /api/profile/juan294` → 200: `{"handle":"juan294","dimensions":
  {"delivery":100,"quality":79,...},"compositeScore":80,"archetype":"Builder",
  "tier":"High",...}` — a public, no-auth, structured profile. A tool response
  already.
- MIT `LICENSE` at root; `app/.well-known/` exists.
- `apps/web/app/studio/useStudioCommands.ts` sits on
  `components/terminal/command-registry` (`CommandDef`): **a command
  abstraction already drives the Studio** — human clicks (`QuickControls`) and
  typed terminal commands both flow through it.
- `apps/web/app/studio/studio-options.ts` defines `STUDIO_CATEGORIES` — 9
  categories, each option carrying a natural-language description ("Gold Leaf
  — metallic gold leaf texture"). A pre-written tool schema.
- Badges are HMAC-SHA256 signed with a public `/api/verify/[hash]` route.

The build is one adapter layer: register `document.modelContext` tools over
the command registry and existing APIs. No new backend.

### The concept — lead with the Studio, close with verify

**A. LEAD — the developer in the Studio, agent as art director and coach.**
The flow only WebMCP makes possible: the agent operates inside the human's
authenticated session — no API key, no OAuth grant — while both watch the same
screen. "Make it feel like molten metal, and tell me what's dragging my score
down." `list_style_options` → `apply_badge_style` (visible re-render between
calls) → the human interrupts and redirects → `simulate_score` +
`suggest_improvements` grounded in real 12-month GitHub data. The save is
human-gated: the agent proposes, only the human commits.

**B. SECOND ACT — the recruiter's agent verifying a claim.** The narrative
differentiator, with the honest caveat: these tools wrap already-public REST
(`/api/profile/`, `/api/verify/`), so alone they are thin leverage. Their
value is discovery (tools declared in place with schemas) and the story:
`verify_badge` proves the numbers weren't fabricated — **a trust layer for
agent-readable claims about humans**, exactly as hiring becomes
agent-mediated. Presented first it invites "you didn't need WebMCP"; presented
second it reads as reach.

**C.** The badge becomes an agent-legible artifact wherever embedded.

### Tool surface

`/studio` (session or demo mode — the leverage core):
`list_style_options`, `apply_badge_style`, `preview_badge`,
`save_badge_config` (**human-gated**), `reset_badge_config`, `simulate_score`,
`suggest_improvements`.

`/u/[handle]` + `/verify` (public, thin-leverage, trust story):
`get_impact_profile`, `get_impact_history`, `verify_badge`,
`explain_dimension`, `compare_profiles`.

Annotate reads with `readOnlyHint`; register write tools only on `/studio`.

### Scoring

- **WebMCP Leverage** (also the tiebreaker): depth rests on the Studio side —
  session inheritance, route-conditional registration, a human-gated write,
  tools returning structured JSON *and* visible UI mutation, one command
  registry with three drivers (clicks, terminal, agent — verifiable in one
  file). The public read tools do NOT carry this criterion.
- **Execution**: best in portfolio; live, tested, command layer exists. Eight
  days is comfortable, not heroic.
- **Potential Impact**: verifiable credentials for agent-mediated hiring.
- **Creativity & Ambition**: the verify direction is contrarian; most entries
  will be agent-books/buys/fills-a-form.
- **Judge access**: public handles need no signup. For the Studio, do NOT use
  a throwaway GitHub account (flagged logins; OAuth breaks inside ChatGPT's
  browser). Build feature-flagged **demo mode** (`/studio?demo=1`): anonymous
  sandbox handle, full tool surface, scratch-config writes. ~1 day. Since
  judges may skip live testing entirely, the video must carry the Studio act
  end-to-end on its own.

### Demo video (<3 min)

0:00–0:20 setup: your badge, your agent, one screen. 0:20–1:30 Studio
co-design — visible re-renders, human interrupts, human clicks the gated Save.
1:30–2:20 recruiter's agent: `get_impact_profile` → `verify_badge` pass, then
fail on a tampered hash. 2:20–2:50 architecture: one command registry, three
drivers, session inherited, writes human-gated.

---

## 4. Alternative: Paisaxe — the itinerary the agent builds and you edit

VERIFIED: `src/app/api/mcp/{places,weather,save-favorite,make-booking(+status)}`
exist with tests, plus `src/lib/mcp-auth.ts`. Vocabulary shipped; only
browser-side registration missing. Voice + map + agent is a pretty demo.

Why second: travel planning is the most duplicated concept in the pool —
worse, OpenAI showcases WanderNote, an editable trip planner, as an official
WebMCP pattern (parallel doc's finding, which strengthens this concern:
judges will have seen this demo before). `make-booking` touches Stripe →
needs a judge-safe sandbox. Repo private, no license, commercial. Fallback
only.

## 5. Idea 3 — Archy: the fleet console an agent operates

Most creative framing available (human-agent collaboration surface for
supervising *other agents*; every mutation approval-gated on the page), and
on record for a future event with longer runway. Fails here: publishing the
repo publishes Juan's private fleet data; judges see an empty console;
highest execution risk.

Also considered: Clarity (crowded category, WebMCP adds little), Portfolio
(impact ~zero).

---

## 6. Blocking decision and evidence

**Chapa's repo must go public to enter with Chapa.** License settled (MIT in
tree).

**Secret-history scan: CLEAN.** VERIFIED 2026-08-26 on local clone at
`b513861f` (develop + main, 2065 commits), four passes:

1. gitleaks 8.30.1, default history — no leaks (1548 non-merge commits).
2. gitleaks `--log-opts="--all --full-history"` — no leaks.
3. gitleaks over all ~500 merge-commit diffs (which `git log -p` skips) — no
   leaks.
4. Custom grep for password-bearing connection strings and HS256 JWTs
   (Supabase service-role shape) at every 25th commit — only hits are
   `postgresql://postgres:postgres@127.0.0.1:54332` in
   `scripts/test-contract-local.test.ts`: the local-Supabase default, not a
   secret.

The repo's `.gitleaks.toml` allowlists exactly one commit (`92f354ee`); its
diff was read — the token is `gho_abc123`, a fake in an OAuth test. Only
env-like file ever tracked: `.env.example`.

Residual limits, stated honestly: gitleaks is rules-based (a prefix-less
high-entropy secret could slip through), and the custom grep sampled every
25th commit. Risk judged low — runtime secrets live in Vercel env and no
`.env` was ever committed. If Juan prefers zero history exposure anyway, seed
a fresh public repo from a clean tree: the rules require complete source, not
complete history.

### 8-day shape

| Day | Work |
| --- | --- |
| 1 | Runtime spike: hello-world tool callable in BOTH judging clients. Decide repo strategy (scan already clean) |
| 2 | Studio tools over the `CommandDef` registry (the lead act) |
| 3 | Human-gated `save_badge_config`; `reset_badge_config` |
| 4 | `simulate_score` + `suggest_improvements` |
| 5 | Demo mode (`/studio?demo=1`) |
| 6 | Public read tools on `/u/[handle]` + `/verify`; `readOnlyHint` annotations |
| 7 | Repo public; README prior-work/new-work split with commit dates; demo video; write-up |
| 8 | Buffer. Deadline 09-03 13:00 PT. Then freeze until ~09-23 |

---

## 7. Reconciliation with the parallel analysis (Summon recommendation)

`2026-08-26-webmcp-hackathon-project-fit.md` (another session, same day)
recommends **Summon Workspace Forge** — a new browser-based visual workspace
designer reusing summon's layout modules — with Paisaxe as the higher-upside
alternative and Chapa as backup.

**Points I adopt from it** (each checked or credited above): judges may
decline live testing; tiebreak order puts WebMCP Leverage first; the
post-deadline freeze; the WanderNote precedent against Paisaxe; the
`readOnlyHint`/`untrustedContentHint` security annotations; and the fact that
**Summon is eligible today** — public repo, MIT LICENSE file (VERIFIED in
tree; GitHub's API shows "none" — a detection gap, worth fixing so the license
is "prominently displayed" per the rules), live GitHub Pages gallery (200).
My earlier "every viable entry requires a repo flip" claim was wrong and is
corrected in §2.

**Where I disagree, verified:** the parallel doc leans on Summon's "existing
visual layout builder." VERIFIED via `docs/user-manual.md` (§`summon layout
create`): that builder is an **interactive TTY wizard — "Requires a TTY"** —
and the live site is a **static** showcase gallery. The browser app, the
layout-module port, the WebMCP surface, and any share/export flow are all
greenfield inside 8 days. That concedes the eligibility point but flips the
Execution comparison: Chapa's entry is an adapter layer over a live, tested
product; Summon's is a new product. Summon's audience (macOS + Ghostty users
arranging terminal panes) is also the narrowest Potential Impact story of the
three finalists.

**My ranking stands: Chapa > Summon > Paisaxe** — with the honest condition
that Chapa requires Juan's repo-publication decision (now de-risked by the
clean scan) while Summon requires none. If Juan does not want to publish
chapa in any form, Summon becomes the rational entry and the parallel doc's
plan is the right one to execute.

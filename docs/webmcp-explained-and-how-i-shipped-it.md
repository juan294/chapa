# WebMCP, Explained. And What Happened When I Shipped It

*Part one is a plain explanation of WebMCP for anyone. Part two is a build log: 19 page registrations across 18 distinct tool names, a nine-tool remote MCP endpoint, the rules I ended up with, and the parts that surprised me.*

---

<!-- IMAGE 1 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: A wide hero illustration, dark forest-green background (#08170f) with a jade green accent (#10b981). Left side: a stylized browser window rendered as a restaurant table, with an AI agent figure squinting at other diners' plates through a magnifying glass, trying to guess the menu. Right side: the same browser window, but now a clean printed menu card is being handed directly to the agent. A thin jade divider separates the two halves. Minimal, flat vector style, no text labels, generous negative space, editorial tech-blog quality. 16:9. -->
<!-- CAPTION: Today an agent reconstructs what a site can do by watching. WebMCP is the site handing over the menu. -->

## Part 1

## What WebMCP actually is

### The problem, stated plainly

Ask an AI agent to book a table for you and watch what it does.

It takes a picture of the page. It looks at the picture and decides which shape is probably a button. It clicks. It waits. It takes another picture to find out what happened. It is doing your job with your eyes, except slower, and you are billed for every glance.

This works well enough to impress people in a demo or when you have a lot of time to get something done and you don't care about token inefficiency. It stops working (or has to be redone) the moment the site changes its layout. It doesn't work if you care about your token usage. Or if you're in a hurry.

Now here is the part that should bother you. That restaurant site already knows, exactly and unambiguously, that it can search availability, hold a table, and confirm a booking. Those are named functions in its codebase. A developer wrote them. They have parameters and return values.

None of that is visible to the agent. All of it is buried under a layout that was designed for a person with eyes.

Runtime registration creates a second visibility problem. A WebMCP tool exists only after a compatible browser loads the page, runs its JavaScript, and keeps the tab open. Search crawlers, remote MCP clients, and agents that only read static text never see that runtime catalog. I missed this distinction at first. Making a page operable inside one browser does not make the site discoverable outside that browser.

So the agent is not failing at reading pages. The pages were simply never written for anything except people. It made sense before. It doesn't make sense anymore.

### The idea

**WebMCP is a browser API, from the Chrome and Edge teams, that lets a page write down what it can do.**

A page declares a list of actions. Each action gets a name, a description written in plain language for a model to read, and a schema listing which inputs it accepts. An agent visiting the page reads that list and calls the actions directly. No screenshots. No guessing which div is clickable.

If you know MCP, the protocol that connects Claude or ChatGPT to external tools, WebMCP uses the same idea of named, schema-described tools. It is not MCP transported through a tab. The page registers ephemeral tools, and the browser connects them to an in-browser agent. Chrome's own documentation calls these MCP-inspired browser APIs, and the specification requires no MCP wire protocol.

### Four things that follow from this

**Most UI guessing stops.** The agent receives a list of typed actions instead of a picture. There is no interpretation step where a misread pixel quietly does the wrong thing to your shopping cart. The model still has to pick the right tool, read your description, and construct valid arguments, so judgment does not disappear. It just moves from "which rectangle is the button" to "which action did the user mean".

**The session is already there.** The action runs inside the user's own tab, in their own session. The agent never holds an API key and never does a separate login. That deletes most of the credential plumbing that agent integrations usually drown in. It does not delete authentication or authorization: your server still has to check who is calling and whether they are allowed to do this. A tool call is a request like any other.

**The tool list changes with the page.** A logged-out visitor's agent sees read-only actions. After sign-in, the same page can offer order history and checkout. The agent does nothing clever. It reads the list again. Your existing permission logic decides what goes in the list.

**Your product stays a product.** The action runs on the visible page rather than in a datacenter, so you are not reduced to a JSON endpoint that somebody else's chat window is calling. Whether the user actually *watches* the action happen is up to you. Nothing in the API renders anything, and I had to build that part deliberately in Chapa.

### What the code looks like

A tool is a plain JavaScript object. It goes in the front-end code you already ship.

```javascript
document.modelContext.registerTool({
  name: "hold_table",
  description: "Hold a table for a given party size and time",
  inputSchema: {
    type: "object",
    properties: {
      partySize: { type: "number" },
      time: { type: "string" },
    },
    required: ["partySize", "time"],
  },
  async execute({ partySize, time }) {
    await holdTable(partySize, time);
    return `Held a table for ${partySize} at ${time}`;
  },
});
```

Look at `execute`. It calls `holdTable`, which is the function already sitting behind your own booking button. You are not building a second version of your product for machines. You are pointing at the one you have.

For a first tool, the description is close to the only genuinely new work. It is prose, and a language model reads it to decide whether this is the right action to call, so write it for a reader rather than for a linter. A production tool surface asks for more than that, and Part 2 is largely about what the "more" turned out to be.

One caveat on the schema, because it is easy to misread what it buys you: it guides the agent toward well-formed calls. It does not replace runtime validation, authorization, or server-side access checks. Treat arguments arriving through `execute` exactly as you would treat a request body.

If the thing you want to expose is already an HTML form, you can skip the JavaScript. Two attributes on the markup you already have, and the browser derives the schema from your inputs. Note what that does by default: the agent fills the fields and focuses the form, and a person submits it. Letting the agent submit on its own is a separate opt-in via `toolautosubmit`.

### Where it sits among the alternatives

There are several ways an agent can already reach an application: hitting a raw API, connecting to a backend MCP server, driving a mouse from screenshots, running a browser automation library, or talking to the site's own built-in chatbot.

Akshay Pachaar wrote an excellent breakdown that lays all six side by side and shows what each one gives up. **[Read it here](https://x.com/akshay_pachaar/status/2093452397402317239).** It is the clearest explanation of the landscape I have seen, and it is what convinced me to stop reading and start building.

The short version of his conclusion, which matches what I found in practice: every other option sacrifices at least one of three things. Whose agent does the work. How much the user must configure first. Whether the agent receives real named actions or has to infer them. WebMCP is the only one that keeps all three.

<!-- IMAGE 2 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: A clean comparison diagram on a dark forest-green background (#08170f). Three horizontal lanes stacked vertically, each showing an agent icon on the left and a website icon on the right, with different connections between them. Lane 1 "screenshots": a dotted, wobbly line with small eye icons along it, colored muted grey. Lane 2 "DOM scraping": a line passing through a tangle of anonymous rectangles, colored muted amber. Lane 3 "WebMCP": a straight, confident jade green (#10b981) line with three labeled connector nodes on it. Flat vector, minimal, no body text, only the three lane labels. 16:9. -->
<!-- CAPTION: The same journey, three different levels of guessing. -->

### The honest status

One browser family has shipped it, behind a flag. The specification is not final. The set of agents that actually call these tools today is small.

But the cost of trying is close to zero, because you are wrapping functions you already wrote. That asymmetry is why I built it into a production app before the standard settled.

---

## Part 2

## How I implemented WebMCP in Chapa

**[Chapa](https://chapa.thecreativetoken.com)** generates a live, embeddable SVG badge that shows a developer's impact profile computed from twelve months of GitHub activity: four or five scored dimensions, an archetype, a composite score, and a cryptographic verification record. It has a Creator Studio where you customize the badge, a public share page, and a verification page.

I shipped **19 WebMCP tool registrations across 18 distinct names**, spread over four page types. Here is what I learned building them.

<!-- IMAGE 3 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: An architecture diagram on a dark forest-green background (#08170f) with jade green (#10b981) accents and thin hairline borders. Four browser-window cards arranged horizontally, labeled "/", "/studio", "/u/:handle", "/verify/:hash". Above each card, a small stack of rounded pill shapes representing registered tools: 2 pills over the first card, 9 over the second, 6 over the third, 2 over the fourth. A single AI agent icon floats above all four, with thin jade lines reaching down to each pill stack. Below the cards, one shared horizontal bar labeled "feature flag: webmcp_enabled" acting as a gate. Flat vector, technical-editorial style, minimal text. 16:9. -->
<!-- CAPTION: 19 registrations, four surfaces, one kill switch. -->

### Design the journey before naming the tools

I did not start with a list of endpoints. I wrote down one user goal for each visible surface, then role-played how an agent and a person would move through it.

| Surface | User goal | Tool role |
| --- | --- | --- |
| `/` | Discover Chapa and route to the right page | Explain capabilities and resolve a profile URL |
| `/studio` | Co-design a badge | Read options, change visible state, and propose a save |
| `/u/:handle` | Read a public developer credential | Read, compare, verify, and embed public data |
| `/verify/:hash` | Understand one verification record | Return the record and explain what it proves |

That goal-first pass exposed an important boundary before I wrote any code. The landing page had to tell the agent that GitHub login is human-only and that an agent may propose a save but cannot confirm it. Those limits belong in the first capability result, not in an error after an agent has already tried to cross them.

### The published tool map is a tested contract

The four surfaces share one pure `SITE_TOOL_MAP`. The landing page, `llms.txt`, `llms-full.txt`, the WebMCP catalog, and the remote MCP tests all import or assert against that same map. A test compares every published name with the actual catalog source. If I add, remove, or rename a tool without updating its public description, the build fails.

This sounds like a small detail. It is what keeps machine-readable advertising honest. A hand-written list can become wrong in one release. A tested contract makes drift a failed change instead of stale documentation.

### Rule 1: Do not build an agent API. Point at the one you have.

Chapa's Creator Studio is a terminal. You type `/set background solid` or `/preset maximum`, and the badge preview re-renders. There is also a panel of clickable Quick Controls that insert those same commands.

The tempting move, when adding agent support, is to write a parallel path: an agent calls a tool, the tool sets React state directly, done. I did not do that. Every mutating Studio tool routes through the same command registry the human uses:

```typescript
{
  name: "apply_badge_style",
  description: "Apply one Creator Studio style option through the visible terminal.",
  inputSchema: APPLY_STYLE_INPUT_SCHEMA,
  execute: (inputs) => {
    // ...validation elided
    const result = runCommand(`/set ${inputs.category} ${inputs.value}`);
    return serializeCommandResult(result, getCurrentConfig());
  },
}
```

The agent writes a command string. The same string a person would type.

This has two consequences I did not fully anticipate.

The first is correctness for free. Quick Controls, typed input, and agent tools all converge on one `executeCommand` call, which produces one result object, which updates the React config, the live preview, the terminal transcript, and the save state together. There is no way for the agent's view of the badge to drift from the human's, because there is only one view.

The second is that **the agent's work is visible**. When the agent applies a preset, the command appears in the terminal transcript and the badge redraws on screen. The user is not reading a summary of what an agent claims it did somewhere else. They are watching it happen in the interface they already understand. That turned out to be the single most convincing thing about the whole feature when demonstrating it.

Worth being clear about where that comes from: WebMCP does not give you this. The API renders nothing. A tool that quietly mutated React state would be equally valid WebMCP and completely invisible. Visibility here is a consequence of routing agent actions through the same command registry that already drives the terminal and the preview. If you take one implementation idea from this post, take that one, because it is cheap when you build it in and awkward to retrofit.

<!-- IMAGE 4 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: A funnel/convergence diagram on a dark forest-green background (#08170f). Three input sources on the left, each a small labeled icon: a mouse cursor ("Quick Controls"), a keyboard ("Typed command"), and a small robot face ("Agent tool"). Three jade green (#10b981) lines flow right and merge into a single thick line entering a rounded box labeled "executeCommand". From that box, one line exits and splits into three outputs on the right: a terminal window icon, a badge/card icon, and a save/disk icon. Flat vector, minimal, technical diagram style. 16:9. -->
<!-- CAPTION: One command registry. The agent has no private path to state. -->

### Rule 2: The agent may propose. Only a person may commit.

Studio has nine tools. Eight of them do exactly what they say. The ninth is `save_badge_config`, and it deliberately does not save anything:

```typescript
{
  name: "save_badge_config",
  description: "Ask the user to confirm saving the current preview configuration.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  execute: () => {
    proposeSave();
    return "Save proposed \u2014 the user must confirm on-page.";
  },
}
```

Calling it opens a confirmation control on the page. It never touches the save API. Only a human click continues.

This was not a security requirement handed to me. It came from thinking about what the tool boundary means. Everything before the save is reversible and visible: change a color, watch it, change it back. The save writes the Studio configuration to the database, so it becomes the starting point when you come back. The reversible steps are a fine place for autonomy. The durable write is not.

To be accurate about what that write reaches: when I first shipped the tools, the save persisted only the Studio preview configuration, and the public SVG renderer did not consume it. That split is closed now. There is one badge implementation, the saved configuration drives the embedded SVG, the share page and the social preview image, and a save invalidates every cached copy of them. The gating argument never depended on which it was. A durable write is a durable write, and now that it does drive the badge people embed in their READMEs, the gate is already in the right place.

Concretely: an agent can redesign your entire badge in twelve tool calls, and you can undo all of it by refreshing the page. It cannot make one of those changes permanent without you.

If you build WebMCP tools, I would make this the first design decision, before writing any tool at all. Draw the line between what an agent may do alone and what needs a hand on the mouse, then put the gate at that line and not somewhere convenient.

### Rule 3: A tool result is a security boundary, and it is a new one

This is the part I underestimated most.

A WebMCP tool returns a string. That string goes into the context window of an AI agent running in the visitor's browser. Chapa's data is largely derived from GitHub, which means some of it is text that other people control, starting with the `displayName` on a GitHub profile.

So there is a path: a stranger sets their GitHub display name to something crafted, a visitor's agent reads a Chapa profile, and that text lands in the agent's context. That is prompt injection with extra steps, and the tool boundary is where it has to be addressed.

Addressed, not solved. I want to be careful with the verbs here, because this is an area where confident language does real harm. Nothing below neutralizes prompt injection or stops it. A single crafted sentence, short and free of control characters, passes every check I wrote. What the three defenses below do is bound the attack surface, label the content as untrusted, and keep the tool boundary from becoming a hole in rules that already exist elsewhere. That is mitigation.

**Bounded free text.** Any string from a GitHub-controlled field is projected before it crosses the tool boundary:

```typescript
export function sanitizeFreeTextForAgent(
  value: string | undefined,
  maxLength: number = MAX_AGENT_FREE_TEXT_LENGTH,
): string | undefined {
  if (value === undefined) return undefined;
  const stripped = value
    // Deliberately matching ASCII control chars (incl. newlines).
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim();
  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped;
}
```

Newlines matter more than they look. In a plain-text agent payload, a newline is how you fake structure and pretend to be a new instruction, so they get flattened to spaces. A cap of 255 characters, which is GitHub's own limit on that field, bounds how much a hostile string can carry. Neither trick makes the text safe. Both make it smaller and flatter.

Note the boundary is narrow on purpose. This projection applies only to WebMCP tool output. The badge SVG and the share page HTML still render the full, untruncated name, because those paths are read by people and already escape correctly. A sanitizer that leaks into a render path becomes a display bug.

**Explicit trust annotations, with no default.** Every tool that can return externally-influenced content is marked `untrustedContentHint: true`, which asks the client to treat the result as data rather than instructions. The name is honest about its own strength. It is a hint. It signals the client, it does not bind the model, and Chrome's guidance is explicit that model-level safety cannot be guaranteed. I set it because withholding a true signal helps nobody, not because it closes the hole. The shared `explain_dimension` tool is used by both Studio (trusted, it is your own logged-in session) and the public profile page (untrusted, it is a stranger's data). Its options type requires the caller to pass annotations explicitly:

```typescript
  /**
   * No default on purpose: the caller must state whether the page it's
   * rendering on shows trusted (Studio) or untrusted (public share page)
   * data. Defaulting would recreate the silent-classification bug this
   * option exists to prevent.
   */
  annotations: WebMcpToolAnnotations;
```

An earlier version had a default. The default was correct for one call site and silently wrong for the other, which is exactly the kind of bug that never shows up in a test you thought to write. Making it a required field turned a runtime judgment call into a compile-time one.

**Redaction that follows the existing rules.** Chapa hides a profile's confidence score and its penalty reasons from visitors. That rule already existed for the rendered page. The tools honor the same rule, stripping `confidence` out of verification records before returning them. A new access path must not become a new way around your existing privacy rules, and a tool surface is very good at quietly becoming one.

The general shape of all three: the tool boundary is an output boundary, and it deserves the same suspicion you already give your input boundaries. On the way in, the rule from Part 1 still applies. Schemas guide the agent, they do not replace runtime validation, authorization, or server-side access checks. Every mutating Chapa tool validates its arguments in code before doing anything, and every fetch a tool makes goes through the same rate-limited, authenticated API routes the page itself uses. There is no agent bypass, because there is no agent-only path.

<!-- IMAGE 5 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: A security boundary diagram on a dark forest-green background (#08170f). Left side: a GitHub-style profile card containing a suspicious-looking text field with squiggly redacted content, colored in muted coral/red (#E05A47). Center: a vertical jade green (#10b981) filter membrane, drawn as a dotted vertical line with three small labeled gates on it. Right side: a clean AI agent icon receiving a short, tidy text block. An arrow crosses the membrane and visibly loses its jagged edges. Flat vector, minimal, no body text beyond three tiny gate labels. 16:9. -->
<!-- CAPTION: Text a stranger controls gets bounded, flattened, and labeled untrusted before it reaches a visitor's agent. It reduces the attack surface. It does not make the text safe. -->

### The lifecycle details nobody warns you about

WebMCP is a browser API in an experimental state, being called from React components that re-render constantly. Some practical notes.

**Feature-detect twice.** Checking `"modelContext" in document` is not enough, because a partial or malformed implementation can satisfy that and then fail on the call. The code also checks that `registerTool` is actually a function:

```typescript
if (!enabled || typeof document === "undefined" || !("modelContext" in document)) {
  return;
}

const modelContext = document.modelContext;
if (!modelContext || typeof modelContext.registerTool !== "function") {
  return;
}
```

**Registration is scoped to an AbortController.** One controller per effect, aborted in React cleanup. This is the API's own unregistration mechanism, and it maps onto React's effect lifecycle cleanly.

```typescript
const controller = new AbortController();
document.modelContext.registerTool(tool, { signal: controller.signal });
// React effect cleanup
controller.abort();
```

**Separate the catalog from the state, or you will thrash.** This was the subtle one. If your effect depends on the tool array, every state change re-registers every tool, because the array is rebuilt on each render. My effect depends on a signature string built from only the stable parts of each tool (name, title, description, schema, annotations). The `execute` implementations live in a ref that updates separately. Changing the catalog re-registers. Changing the badge color does not, and calls still resolve against the current state.

**Registration failure is not a page failure.** Every registration is wrapped, both for synchronous throws and rejected promises. If WebMCP breaks, the page is a normal page. A visitor should never see a broken product because an experimental browser API had a bad day.

**Instrument at the wrapper, and never let instrumentation change behavior.** Tool calls emit an analytics event, failures emit a bounded error event, and the tracking call itself is inside a try/catch that swallows everything. If PostHog is blocked by an ad blocker, the tool still works.

The server now records the same kind of operational signal. A small user-agent classifier recognizes known agent traffic without retaining the raw user-agent string. Static agent-surface requests emit `agent_surface_fetch`, and remote MCP calls emit `mcp_tool_called` with the tool name, outcome, duration, and agent class. I did not have a reliable usage window large enough to publish counts when I finished this article, so I am not turning deployment checks into adoption numbers.

### What I did not build

**No polyfill.** There is a library that shims `document.modelContext`. I ran a hello-world tool through real flagged Chrome first, and it registered, was discovered, and executed correctly. Adding a dependency and CSP surface to solve a problem I had not observed did not pass the bar. If native support had failed, the answer would have been different.

**No `Origin-Agent-Cluster` header.** Chrome's documentation says WebMCP requires origin-isolated documents. It turns out you only need to act if you are opting *out* with `Origin-Agent-Cluster: ?0`. Chapa's responses send no such header, and registration worked. I wrote that down rather than adding a header defensively, because an unnecessary header is a thing future maintainers have to reason about forever.

**No production rollout without a switch.** Three feature flags gate this: `studio_enabled` for the Studio itself, `studio_demo_enabled` for anonymous demo access, and `webmcp_enabled` as a remote kill switch. When `webmcp_enabled` is off, the catalog is empty and the client hosts are not rendered. For an experimental browser API touching a live product, the ability to turn it off from a database row without a deploy is not optional.

### Browser operation and external discovery are separate surfaces

Shipping the runtime tools did not make Chapa easy to find. I added four static declarations: [the landing-page tool map](https://chapa.thecreativetoken.com/#agent-tools), [llms.txt](https://chapa.thecreativetoken.com/llms.txt), [llms-full.txt](https://chapa.thecreativetoken.com/llms-full.txt), and [the well-known MCP marker](https://chapa.thecreativetoken.com/.well-known/mcp.json). These surfaces advertise the same tested catalog without requiring JavaScript or flagged Chrome.

I also shipped a stateless [Streamable HTTP MCP endpoint](https://chapa.thecreativetoken.com/api/mcp) for clients that do not control a browser tab. It exposes nine public, read-only tools and calls the same application libraries as Chapa's public routes. Studio mutation tools stay browser-only because their value comes from shared, visible page state and the human confirmation gate.

The endpoint is active in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.juan294/chapa) as `io.github.juan294/chapa` (registry record version `2.29.0`), and the [Glama connector listing](https://glama.ai/mcp/connectors/com.thecreativetoken.chapa/chapa) is live. I also submitted Chapa to WebMCP and `llms.txt` directories and to MCP Servers. Some directory reviews were still pending when I finished this article. One WebMCP scanner rejected the site because it looked for an older browser API signature instead of the current `document.modelContext` API. That result was useful: directory compatibility is another contract, and it can lag the runtime specification.

### The evidence, and its limits

I want to be precise about what I have actually verified, because "I shipped WebMCP" can mean several very different things.

Verified: a hello-world tool passed **native registration, discovery, and execution in Google Chrome 151.0.7922.174** with `chrome://flags/#enable-webmcp-testing` enabled, deployed on a real preview. That was the gate I set before writing the full catalog, and it passed.

Verified: the full browser catalog is implemented and tested, with each tool host carrying its own render test. The remote endpoint has a separate transport contract matrix and a parity assertion that keeps its nine tool names tied to the browser catalog.

Verified: the browser code has shipped in every release since v2.24.0. The static discovery surfaces, telemetry, and remote MCP endpoint first shipped in v2.29.0. The current production endpoint identifies itself as Chapa v2.29.4 and lists all nine read-only tools.

Verified: an agent drove the full catalog end to end on production on 2026-09-01, in Chrome 151 with the WebMCP flag: landing discovery, the demo Studio, the human save boundary, a public profile, and its verification record, including the altered-hash negative case. The [cleaned transcript](https://github.com/juan294/chapa/blob/main/docs/webmcp-demo-transcript.md) preserves every tool name, argument, route, boundary, and visible page effect. It is linked from Chapa's landing page as the agent-tested proof, because a tool catalog is a claim and a transcript is evidence.

One more practical note if you are planning a demo. Chrome's WebMCP origin trial runs from Chrome 149 to 156 and ends **17 November 2026**. Without a trial token, your visitors need to enable the flag themselves. With a token, unflagged Chrome works. Decide which of those your audience is before you record anything.

<!-- IMAGE 6 -->
<!-- INSERT IMAGE HERE -->
<!-- PROMPT: A single wide screenshot-style mockup on a dark forest-green background (#08170f). Left two-thirds: a browser window showing a developer badge card with a radar chart and jade green (#10b981) accents, plus a terminal strip underneath showing three command lines. Right one-third: a narrow AI chat panel with a short conversation and a highlighted "Confirm save" button glowing jade. A thin jade arrow connects the chat panel to the terminal strip. Flat vector illustration, not photorealistic, minimal text (illegible placeholder lines are fine). 16:9. -->
<!-- CAPTION: The agent panel, the terminal, and the badge on one screen. The confirm button is the only way anything becomes permanent. -->

---

## If you are going to try this

Start with the smallest honest thing.

1. Pick one action your site already performs and one function that already performs it.
2. Register it as a tool. Write the description as a sentence, not a label.
3. Open it in flagged Chrome and call it.

That whole loop is an afternoon. The reason to do it now, while the spec is unfinished and the audience is small, is that the work is not throwaway. You are describing your own product in a machine-readable way, and that description will be useful regardless of which protocol wins.

The web has never been silent about itself to machines. APIs, semantic HTML, the accessibility tree, and structured data all exist and all predate this. What has been missing is a broadly adopted, browser-native way to expose live, agent-callable page actions, in session, on the page the user is looking at. WebMCP is a serious attempt at that, written by the only party that actually knows the answer: the site itself.

---

**Source and credit.** The general explanation in Part 1 was inspired by [Akshay Pachaar's WebMCP breakdown](https://x.com/akshay_pachaar/status/2093452397402317239), which is the clearest side-by-side comparison of agent access patterns I have read. Go read the original.

**Specs and docs.**
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp), including how WebMCP relates to MCP itself
- [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api), for the form attributes and `toolautosubmit`
- [Chrome WebMCP security guidance and best practices](https://developer.chrome.com/docs/ai/webmcp#security)
- [W3C WebMCP specification](https://webmachinelearning.github.io/webmcp/)

**Chapa** is at [chapa.thecreativetoken.com](https://chapa.thecreativetoken.com).

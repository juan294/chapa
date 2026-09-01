# Phase 5: agent traffic analytics (#1262)

Branch: `feature/1262-agent-traffic-analytics`
Depends on: phase 1 (instruments its routes), phase 4 (instruments the MCP
endpoint).

Half of this issue already exists: the WebMCP adapter emits
`webmcp_tool_called` `{tool, outcome, durationMs}` client-side
(`use-model-context-tools.ts:42-78`). This phase adds the server half.
No dashboards, no alerts, no gates; PostHog is read directly.

## Step 1 (tests first): UA classifier

New `apps/web/lib/analytics/agent-ua.ts` + `agent-ua.test.ts`:

```ts
export type AgentClass =
  | "openai" | "anthropic" | "perplexity" | "google" | "meta"
  | "mcp-client" | "generic-bot" | null;
export function classifyAgentUserAgent(ua: string | null): AgentClass
```

Pure substring table over known agent UAs (GPTBot, ChatGPT-User, OAI-SearchBot,
ClaudeBot, Claude-User, claude-web, anthropic-ai, PerplexityBot,
Perplexity-User, Google-Extended, GoogleOther, meta-externalagent,
node-fetch/undici defaults excluded, `mcp` substring for SDK clients,
plus a generic `bot|crawler|spider` catch-all). Returns null for normal
browsers. Case-insensitive. Tests cover one UA per class plus Chrome and
Safari returning null.

## Step 2: instrument the static agent surfaces

In `llms.txt`, `llms-full.txt`, and `.well-known/mcp.json` route handlers:

```ts
export function GET(request: Request): Response {
  const agentClass = classifyAgentUserAgent(request.headers.get("user-agent"));
  if (agentClass) void captureServerEvent("agent_surface_fetch", {
    surface: "llms.txt", agentClass,
    ua: (ua ?? "").slice(0, 200),
  });
  return new Response(...unchanged...);
}
```

Fire-and-forget, never awaited; `captureServerEvent` already no-ops
without PostHog env and never throws, so the existing route tests keep
passing with no request argument changes beyond adding the parameter.
Only classified agents are captured; normal browser traffic is not.

## Step 3: instrument the MCP endpoint

In the phase 4 tool wrapper, mirror the client instrumentation: emit
`mcp_tool_called` `{tool, outcome: ok|invalid_input|error, durationMs,
agentClass}` via `captureServerEvent`, classifying outcome by the
`WEBMCP_INVALID_INPUT_PREFIX` convention exactly as
`instrumentTool` does client-side. Instrumentation must never change tool
behavior (copy the try/catch guard comment).

## Step 4: tests

- Route tests: with a `GPTBot` UA header, `captureServerEvent` (mocked) is
  called with `surface` and `agentClass: "openai"`; with a Chrome UA it is
  not called.
- Server-tools test: a tool that throws still returns its error string to
  the caller and emits `outcome: "error"`.

## Success criteria

Automated: full suite green.

Manual: after deploy, a PostHog query on `agent_surface_fetch` and
`mcp_tool_called` answers "which agents visited this week and which tools
did they call" (issue #1262's acceptance line).

# Phase 0 — Runtime spike (gate: nothing else proceeds until this passes)

Goal: a hello-world tool registered on a deployed page, verified callable in
BOTH judging clients. Output: `docs/research/2026-08-27-webmcp-runtime-spike.md`
recording exactly what worked, plus the go/no-go on a polyfill.

Steps:
1. Branch + minimal registration in a dev-only page or behind
   `NEXT_PUBLIC_WEBMCP_ENABLED=true` locally:
   ```js
   if ("modelContext" in document) {
     const c = new AbortController();
     await document.modelContext.registerTool({
       name: "chapa_hello",
       description: "Returns a greeting from Chapa.",
       inputSchema: { type: "object", properties: {}, },
       annotations: { readOnlyHint: true },
       execute: async () => "Hello from Chapa Creator Studio",
     }, { signal: c.signal });
   }
   ```
2. Chrome: enable `chrome://flags/#enable-webmcp-testing`, install the Model
   Context Tool Inspector extension, verify the tool lists and executes.
   Check whether origin isolation requires an `Origin-Agent-Cluster: ?1`
   response header (add to `baseSecurityHeaders` in `next.config.ts:48-65`
   if so) and whether production Chrome users need an origin-trial token
   (register the origin, add the meta tag/header if required).
3. ChatGPT in-app browser: open a Vercel preview URL of the spike branch,
   verify tool discovery/execution. Record precisely what ChatGPT's browser
   supports — if it needs `@mcp-b/global` (bundled, CSP forbids CDN), add it
   and re-verify.
4. Record findings; delete or gate the spike tool.

Manual by necessity: real browser runtimes; no automatable harness exists
for ChatGPT's in-app browser. Automated: the spike page still passes
typecheck/lint.

STOP: if NEITHER client can call tools on a preview deploy, escalate to Juan
same-day — entry strategy needs rethinking (fallback: Summon plan). If ONE
works, proceed but record which; the demo video uses the working client.

# Phase 1: Shared invalid-input helper + telemetry outcome dimension

Enhancement #5 plus the shared plumbing that Phases 2 and 3 import.

Status: Complete.

## Files

- `apps/web/lib/webmcp/use-model-context-tools.ts`
- `apps/web/lib/webmcp/use-model-context-tools.test.ts`
- `apps/web/lib/webmcp/shared-tools.ts`
- `apps/web/lib/webmcp/shared-tools.test.ts`

## Step 1 (RED): failing tests

In `use-model-context-tools.test.ts`:

- `invalidInput("some_tool", "message")` returns exactly
  `"Invalid input for some_tool: message."` and starts with
  `WEBMCP_INVALID_INPUT_PREFIX`.
- Executing a registered tool whose `execute` resolves normally fires
  `webmcp_tool_called` ONCE with
  `{ tool, outcome: "ok", durationMs: <number> }`, after settle (assert the
  mock `trackEvent` was not called before the execute promise resolved).
- A tool whose `execute` resolves to a string starting with the prefix
  (e.g. `invalidInput("x", "bad")`) fires outcome `"invalid_input"`.
- A tool whose `execute` rejects fires `webmcp_tool_called` with outcome
  `"error"` AND still fires the existing `client_error` event with
  `{ source: "webmcp_tool_execute", tool, message }`, and still rejects to
  the caller.
- Update any existing assertion that `webmcp_tool_called` fires before
  execution: the event now fires at settle time. (Check existing specs in
  this file; amend rather than delete coverage.)

In `shared-tools.test.ts`:

- `explain_dimension` with an unknown dimension returns a string equal to
  `invalidInput("explain_dimension", "dimension must be a known dimension")`
  (byte-identical to today's literal, proving no behavior change).

## Step 2 (GREEN): implementation

`use-model-context-tools.ts`:

```pseudo
export const WEBMCP_INVALID_INPUT_PREFIX = "Invalid input for ";

export function invalidInput(tool: string, message: string): string {
  return `${WEBMCP_INVALID_INPUT_PREFIX}${tool}: ${message}.`;
}

// in instrumentTool(...).execute:
async execute(inputs, context = default) {
  const start = performance.now();               // browser + jsdom safe
  try {
    const result = await resolveCurrentTool().execute(inputs, context);
    captureToolEvent("webmcp_tool_called", {
      tool: tool.name,
      outcome: result.startsWith(WEBMCP_INVALID_INPUT_PREFIX)
        ? "invalid_input"
        : "ok",
      durationMs: Math.round(performance.now() - start),
    });
    return result;
  } catch (error) {
    captureToolEvent("webmcp_tool_called", {
      tool: tool.name,
      outcome: "error",
      durationMs: Math.round(performance.now() - start),
    });
    captureToolEvent("client_error", { ...unchanged... });
    throw error;
  }
}
```

Notes:

- The pre-execution `captureToolEvent` call at
  `use-model-context-tools.ts:46` moves to settle time; do not fire twice.
- `captureToolEvent` keeps its swallow-everything try/catch; instrumentation
  must never change tool behavior.
- Placement rationale (do not move to `shared-tools.ts`): `shared-tools.ts`
  imports types from this module; the reverse import would be a cycle under
  `pnpm run check:circular`.

`shared-tools.ts`:

- Import `invalidInput` from `./use-model-context-tools`.
- Replace the literal at `shared-tools.ts:113`
  (`"Invalid input for explain_dimension: dimension must be a known dimension."`)
  with `invalidInput("explain_dimension", "dimension must be a known dimension")`.

## Step 3: verify

`pnpm run test -- lib/webmcp` then full `pnpm run test && pnpm run typecheck
&& pnpm run lint && pnpm run check:circular`.

## Success criteria (automated)

- [x] All new tests pass; no existing test deleted without an amended
  replacement covering the same behavior.
- [x] `check:circular` passes (proves the helper placement is cycle-free).
- [x] Grep check: no remaining pre-execution `webmcp_tool_called` capture.

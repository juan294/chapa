# Client Error Alerts

Client runtime errors are captured in two streams:

- `client_error`: global React error boundary, `window.onerror`,
  `unhandledrejection`, and a WebMCP tool handler that threw
  (`source: "webmcp_tool_execute"`, message bounded to 500 characters). A
  thrown tool also emits `webmcp_tool_called` with `outcome: "error"`, so a
  spike in one without the other points at the reporting path rather than at
  the tool.
- `client_api_error`: non-2xx client fetches from session, owner cache warm, and
  trend data paths.

Alert rule:

- Trigger: 5-minute event count is greater than 10 or increases 3x over the
  previous 30-minute baseline.
- Target: Chapa operational alert webhook / PostHog alert destination.
- Verify: force a local `window.dispatchEvent(new ErrorEvent("error", ...))`
  and confirm a `client_error` event is captured; force a mocked non-2xx fetch in
  hook tests and confirm `client_api_error`.

These alerts are rate signals, not automatic rollback signals. Triage them with
the production route, browser, release SHA, and recent deploy context.

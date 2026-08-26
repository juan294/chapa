# Phase 1 — WebMCP infra: registration hook + feature flags

## 1A. `apps/web/lib/webmcp/use-model-context-tools.ts` (new, client-safe)

```
export interface WebMcpTool {           // mirrors pinned API contract
  name; description; inputSchema; annotations?; execute(inputs, {signal});
}
export function useModelContextTools(tools: WebMcpTool[], enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || !("modelContext" in document)) return;
    const controller = new AbortController();
    for (const tool of tools) {
      void document.modelContext.registerTool(
        { ...tool, execute: instrument(tool) },     // instrument: trackEvent("webmcp_tool_called", {tool: name}) + error capture
        { signal: controller.signal },
      ).catch(warn);                                 // duplicate-name etc. must not break the page
    }
    return () => controller.abort();
  }, [tools, enabled]);
}
```
- Callers pass memoized `tools` arrays (re-register on identity change —
  spec has no update; abort + re-register is the pattern).
- Type the `document.modelContext` surface in `lib/webmcp/types.d.ts`
  (no upstream types assumed; spike may find official ones).
- RED first: new `use-model-context-tools.test.ts` with a mocked
  `document.modelContext` (registerTool spy): registers when enabled+present,
  no-ops when absent/disabled, aborts on unmount, re-registers on tools
  identity change, a rejecting registerTool doesn't throw.

## 1B. Flags: `webmcp_enabled`, `studio_demo_enabled`

New migration `supabase/migrations/035_seed_webmcp_flags.sql` (highest is
034; `pnpm run validate:migrations` gate):
```sql
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('webmcp_enabled', false, 'Browser-side WebMCP tool registration'),
  ('studio_demo_enabled', false, 'Anonymous Creator Studio demo mode')
ON CONFLICT (key) DO NOTHING;
```
Plumb both through the 6 established touch points (pattern verified
2026-08-26): (a) migration; (b) `lib/env.ts` `getWebmcpEnabledEnv` /
`getStudioDemoEnabledEnv` (`NEXT_PUBLIC_WEBMCP_ENABLED`,
`NEXT_PUBLIC_STUDIO_DEMO_ENABLED`); (c) `lib/feature-flags-sync.ts` sync
variants; (d) `lib/feature-flags.ts` async `isWebmcpEnabled` /
`isStudioDemoEnabled` via `checkFlag` + re-export block; (e)
`ClientFeatureFlagsProvider` interface + fallback (add `webmcpEnabled`;
demo flag is server-gate only, not needed client-side); (f) `app/layout.tsx`
Promise.all + `clientFeatureFlags`. Extend `lib/feature-flags.test.ts` /
`feature-flags-sync.test.ts` per existing per-flag test blocks.
Remember: `supabase db reset` locally, then remote `supabase db push` after
merge (standing rule).

Verification: full gates + `validate:migrations` + `test:contract:local`.

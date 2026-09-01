# Phase 2: Studio tools — recovery hints + save wrong-state guard [batch-eligible]

Enhancements #2 (Studio half) and #3. Depends on Phase 1's exported
`invalidInput`. No file overlap with Phase 3.

Status: Complete.

## Files

- `apps/web/app/studio/useStudioWebMcpTools.ts`
- `apps/web/app/studio/useStudioWebMcpTools.test.ts`

## Step 1 (RED): failing tests

In `useStudioWebMcpTools.test.ts`:

- `apply_badge_style` description contains the exact sentence
  `Get valid categories and values from list_style_options first.`
- `apply_badge_style` with invalid input (e.g. `{ category: "two words",
  value: "x" }`) returns a string containing both the invalid-input prefix
  and `call list_style_options`.
- `save_badge_config` with `saveStatus: "saved"`: returns
  `"No unsaved changes. The current configuration is already saved."` and
  `proposeSave` was NOT called.
- `save_badge_config` with `saveStatus: "saving"`: returns
  `"A save is already in progress. Wait for it to finish, then check preview_badge for the save status."`
  and `proposeSave` was NOT called.
- `save_badge_config` with `saveStatus: "dirty"` and with
  `saveStatus: "error"`: `proposeSave` IS called and the existing
  `"Save proposed — the user must confirm on-page."` string is returned
  unchanged (byte-identical; this string predates the no-em-dash rule and
  is deliberately untouched).

## Step 2 (GREEN): implementation

`useStudioWebMcpTools.ts`:

- Delete the local `invalidInput` helper (lines 99-101); import it from
  `@/lib/webmcp/use-model-context-tools` instead. All existing call sites
  keep identical output.
- `apply_badge_style`:
  - description becomes:
    `"Apply one Creator Studio style option through the visible terminal. Get valid categories and values from list_style_options first."`
  - invalid-input branch message becomes:
    `invalidInput("apply_badge_style", "category and value must be single non-empty tokens; call list_style_options for valid categories and values")`
- `save_badge_config.execute`:

```pseudo
execute: () => {
  if (saveStatus === "saved") {
    return "No unsaved changes. The current configuration is already saved.";
  }
  if (saveStatus === "saving") {
    return "A save is already in progress. Wait for it to finish, then check preview_badge for the save status.";
  }
  proposeSave();
  return "Save proposed — the user must confirm on-page.";   // unchanged
}
```

Notes:

- `saveStatus` is already a prop and already in the `useMemo` dependency
  array (`useStudioWebMcpTools.ts:306-318`); the registration hook resolves
  the latest execute through `currentToolsRef`, so no wiring change is
  needed for the guard to see live state.
- `"error"` status intentionally falls through to `proposeSave()`: after a
  failed save, re-proposing is the correct recovery.
- Demo-mode interaction (verified): demo config changes also set
  `"dirty"`, and a confirmed demo save sets `"saved"`, so a judge calling
  `save_badge_config` twice sees the gate once and the no-op guard the
  second time. That is correct behavior and worth showing.

## Step 3: verify

`pnpm run test -- useStudioWebMcpTools` then the full local suite.

## Success criteria (automated)

- [x] New tests pass; terminal command behavior (`/set`, `/preset`, `/save`
  lines) untouched — the existing serializeCommandResult specs still pass
  unmodified.

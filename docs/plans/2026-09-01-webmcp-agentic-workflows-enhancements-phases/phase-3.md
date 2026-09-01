# Phase 3: Share page — compare_profiles growth hint + get_embed_snippet [batch-eligible]

Enhancements #2 (share-page half) and #4. Depends on Phase 1's exported
`invalidInput`. No file overlap with Phase 2.

Status: Complete.

## Files

- `apps/web/app/u/[handle]/SharePageWebMcpTools.tsx`
- `apps/web/app/u/[handle]/SharePageWebMcpTools.render.test.tsx`
- `apps/web/app/u/[handle]/page.tsx`
- `apps/web/components/SharePageOwnerContent.tsx`
- `apps/web/components/SharePageOwnerContentLazy.tsx`
- (check at implement time) `share-page.render.test.tsx` / `page.test.tsx`
  if they assert the props passed to the above components.

## Step 1 (RED): failing tests

In `SharePageWebMcpTools.render.test.tsx`:

- The registered tool list now has 6 tools including `get_embed_snippet`
  with `WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS` and the empty input schema.
- `get_embed_snippet.execute()` returns JSON whose `markdown` and `html`
  equal the `embedMarkdown` / `embedHtml` props verbatim, plus the handle.
- `compare_profiles` on a 404 response returns a message containing
  `https://chapa.thecreativetoken.com/u/<otherHandle>` and the words
  `retry this comparison`.
- `compare_profiles` invalid-handle message is byte-identical to today
  (now produced via `invalidInput("compare_profiles", "other_handle must be a public GitHub handle")`).

For `SharePageOwnerContent`: a render test asserting that when an
`embedHtml` prop is passed, the HTML snippet Copy button copies exactly that
string (mirroring the existing `embedMarkdown` prop pattern).

## Step 2 (GREEN): implementation

`page.tsx` (single build site, extending #1165's rule to the HTML form):

```pseudo
// after line 344 (embedMarkdown)
const embedHtml =
  `<img src="${embedBadgeUrl}" alt="${embedAltText}" width="600" height="315" />`;
// pass embedMarkdown + embedHtml to <SharePageWebMcpTools ...>
// pass embedHtml to <SharePageOwnerContentLazy ...> (embedMarkdown already passed)
```

`SharePageOwnerContentLazy.tsx`: add `embedHtml?: string` to `Props`
(the `{...props}` spread forwards it; one interface line).

`SharePageOwnerContent.tsx`: accept `embedHtml?: string`; use it when
present, falling back to the current internal build at line 138 — the exact
pattern `embedMarkdown` already uses at lines 110-137. Byte-identical
output either way (the fallback string and the page-built string are the
same template).

`SharePageWebMcpTools.tsx`:

- New required props: `embedMarkdown: string; embedHtml: string`.
- Import `invalidInput` from `@/lib/webmcp/use-model-context-tools`;
  replace the inline `compare_profiles` invalid message with
  `invalidInput("compare_profiles", "other_handle must be a public GitHub handle")`.
- `compare_profiles` 404 branch message becomes:

```pseudo
`No public impact profile was found for @${otherHandle}. A profile is
generated on first visit: ask the user to open
https://chapa.thecreativetoken.com/u/${otherHandle} once, then retry this
comparison.`
```

  (Safe to interpolate: `otherHandle` has already passed `isValidHandle`.
  Truthfulness verified: `/api/profile/:handle` 404s only when no snapshot
  exists, and visiting `/u/:handle` persists one.)

- New tool, registered after `compare_profiles`:

```pseudo
{
  name: "get_embed_snippet",
  description:
    "Return ready-to-paste Markdown and HTML snippets that embed this " +
    "profile's live badge, for example in a GitHub README.",
  inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
  annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
  execute: () => JSON.stringify({
    handle,
    markdown: embedMarkdown,
    html: embedHtml,
    note: "The badge image is live; embed it once and it stays current.",
  }),
}
```

- Add the new props to the `useMemo` dependency array.

Notes:

- The snippets deliberately carry the canonical production domain
  (`https://chapa.thecreativetoken.com`), matching the on-page snippets:
  a README embed must point at production even when browsing a preview.
  Do NOT switch to `getBaseUrl()` here.
- Annotations: untrusted variant for consistency with every other tool on
  this public page, even though the snippet contains no free text
  (`embedAltText` is translated copy plus the validated handle;
  `displayName` is not included).

## Step 3: verify

`pnpm run test -- SharePageWebMcpTools SharePageOwnerContent share-page`
then the full local suite.

## Success criteria (automated)

- [x] New tests pass; existing 5-tool assertions updated to 6 without weakening
  redaction/sanitization specs.
- [x] No test asserts `PreviewFooter` or render-path changes: the SVG and HTML
  render paths are untouched by this phase.

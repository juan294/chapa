# Phase 2: schema.org potentialAction JSON-LD (#1257) [batch-eligible]

Branch: `feature/1257-potential-action-jsonld`

Agents increasingly read schema.org Actions to find callable entry points.
Chapa's two JSON-LD blocks have none.

## Step 1: extract the layout object into a testable module

The layout render test mocks `renderJsonLd`, so assertions on the object
belong in a pure module. New `apps/web/lib/structured-data.ts`:

```ts
export function softwareApplicationJsonLd(baseUrl: string): object {
  return {
    ...existing object from app/layout.tsx:145-171, moved verbatim...
    potentialAction: [
      {
        "@type": "ViewAction",
        name: "View a developer's impact profile",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${baseUrl}/u/{handle}`,
        },
        "target-input": "required name=handle",
      },
      {
        "@type": "ViewAction",
        name: "View a developer's embeddable impact badge (SVG)",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${baseUrl}/u/{handle}/badge.svg`,
        },
        "target-input": "required name=handle",
      },
    ],
  };
}
```

(Schema.org confirms `EntryPoint.urlTemplate` as an RFC 6570 URL template.
The non-schema.org `target-input` convention is not used here; the required
`{handle}` variable remains explicit in the template.)

Tests first, `apps/web/lib/structured-data.test.ts`: object has
`@type: SoftwareApplication`, two `potentialAction` entries, each with an
`urlTemplate` containing `{handle}`; snapshot of the full object.

`app/layout.tsx` then imports and calls it (keep the `SAFETY:` comment and
`renderJsonLd` wrapper at the call site).

## Step 2: share page verification action

`apps/web/app/u/[handle]/page.tsx`, `personJsonLd` (line 350): when
`verification?.hash` exists, add:

```ts
potentialAction: {
  "@type": "ViewAction",
  name: "Verify this badge's data integrity",
  target: `${baseUrl}/verify/${verification.hash}`,   // concrete URL
},
```

Extend `share-page.render.test.tsx` (it already un-escapes and
`JSON.parse`s the block at line 566): with verification present, the parsed
JSON-LD has the action targeting `/verify/<hash>`; without verification, no
`potentialAction` key.

## Success criteria

Automated: new unit + render tests pass; full suite, typecheck, lint,
build green.

Manual: paste the deployed landing page URL into Google's Rich Results
test and the schema.org validator; no errors on the SoftwareApplication
or Person blocks.

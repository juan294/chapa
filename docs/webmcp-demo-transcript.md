# Chapa WebMCP production demo transcript

Session date: 2026-09-01

Runtime: Chapa production, Google Chrome 151 with `chrome://flags/#enable-webmcp-testing` enabled

Release: v2.29.0

This is a cleaned transcript of the production preflight recorded in [the demo script](webmcp-demo-script.md). Repeated schema fields and long configuration objects are shortened, but tool names, arguments, routes, boundaries, visible page effects, and trust results are preserved. The public profile and verification payloads were refreshed against the production v2.29.0 remote MCP endpoint after release so the numbers below match the live 2026-09-01 snapshot.

## 1. Find the path from the landing page

**Human**

> What can I do on this site, and where is juan294's badge?

**Agent calls `get_site_capabilities`**

```json
{}
```

**Tool result, abridged**

```json
{
  "whatIsChapa": "Chapa turns developer activity into a live, verifiable Impact Profile and embeddable badge that summarizes delivery, quality, consistency, breadth, and optional craft.",
  "toolMap": [
    { "route": "/", "tools": ["get_site_capabilities", "find_profile"] },
    { "route": "/studio (and /studio?demo=1)", "tools": ["list_style_options", "apply_badge_style", "apply_preset", "preview_badge", "reset_badge_config", "save_badge_config", "simulate_score", "suggest_improvements", "explain_dimension"] },
    { "route": "/u/:handle", "tools": ["get_impact_profile", "get_impact_history", "verify_badge", "explain_dimension", "compare_profiles", "get_embed_snippet"] },
    { "route": "/verify/:hash", "tools": ["get_verification_record", "explain_verification"] }
  ],
  "entryPoints": {
    "demoStudio": "https://chapa.thecreativetoken.com/studio?demo=1",
    "profile": "https://chapa.thecreativetoken.com/u/<handle>",
    "llmsTxt": "https://chapa.thecreativetoken.com/llms.txt"
  },
  "boundaries": [
    "Login uses GitHub OAuth and only a human can complete it.",
    "Configuration saves are proposed by agents and confirmed by a human on-page.",
    "Tools register per page; navigate to a route to use its tools."
  ]
}
```

**Agent calls `find_profile`**

```json
{ "handle": "juan294" }
```

**Tool result**

```json
{
  "handle": "juan294",
  "sharePageUrl": "https://chapa.thecreativetoken.com/u/juan294",
  "badgeSvgUrl": "https://chapa.thecreativetoken.com/u/juan294/badge.svg"
}
```

**Agent**

> Chapa has a demo Studio for shared badge design and public tools for reading and verifying developer credentials. Saves need a human confirmation. I found juan294's public profile and badge. I will open the demo Studio from the site capability map.

**Visible page result**

The browser opens `/studio?demo=1`. The page shows the persistent `DEMO` marker, the badge preview, and the terminal. Nine Studio tools are registered.

## 2. Co-design in the visible Studio

**Human**

> Show the choices, apply Maximum, and stop before saving.

**Agent calls `list_style_options`**

```json
{}
```

**Tool result, abridged**

The result lists every style category, its valid values, the four presets `minimal`, `premium`, `holographic`, and `maximum`, and the current configuration.

**Agent calls `apply_preset`**

```json
{ "name": "maximum" }
```

**Tool and visible page result**

The terminal records `Applied preset: Maximum`. The badge preview redraws with the Maximum preset. The tool result includes the same terminal line and the resulting configuration snapshot.

**Human**

> Keep the spinning border and shimmering score. Use a solid background.

**Agent calls `apply_badge_style`**

```json
{ "category": "background", "value": "solid" }
```

**Tool and visible page result**

The terminal records `background → solid`. The preview redraws. The other preset values stay unchanged.

**Human**

> Use a calmer column sweep. Keep everything else.

**Agent calls `apply_badge_style`**

```json
{ "category": "heatmapAnimation", "value": "fade-in" }
```

**Tool and visible page result**

The terminal records the style command and the preview redraws with the calmer animation. The agent has no private state path. The command, React configuration, preview, and returned snapshot all describe the same change.

## 3. Stop at the human save boundary

**Human**

> Propose this configuration for saving.

**Agent calls `save_badge_config`**

```json
{}
```

**Tool result**

```text
"Save proposed \u2014 the user must confirm on-page."
```

**Visible page result**

The page shows the save confirmation control. No save request has happened.

**Human action**

The human clicks **Confirm save**.

**Visible terminal result**

```text
(demo) configuration not persisted
```

Demo mode keeps the confirmation local. In the real Studio, the same click is the only action that can continue to the authenticated save handler.

## 4. Read the public profile

The browser opens the `sharePageUrl` returned by `find_profile` and waits for the page to finish hydration. Six public-profile tools register.

**Human**

> Read this profile, then verify its badge.

**Agent calls `get_impact_profile`**

```json
{}
```

**Tool result, current production snapshot**

```json
{
  "handle": "juan294",
  "dimensions": {
    "delivery": 100,
    "quality": 80,
    "consistency": 66,
    "breadth": 71,
    "craft": 83
  },
  "compositeScore": 80,
  "adjustedComposite": 79,
  "archetype": "Builder",
  "tier": "High",
  "snapshotDate": "2026-09-01",
  "displayScore": 80,
  "displayTier": "High"
}
```

The page tool also returns render-time freshness metadata. Public output is redacted before it enters the client tree.

## 5. Close the trust loop

**Agent calls `verify_badge`**

```json
{}
```

**Tool result, current production record**

```json
{
  "status": "verified",
  "hash": "84567a48984e0c2e287acb78d1404a57",
  "record": {
    "handle": "juan294",
    "displayName": "Juan González",
    "adjustedComposite": 80,
    "tier": "High",
    "archetype": "Builder",
    "profileType": "solo",
    "dimensions": {
      "delivery": 100,
      "quality": 82,
      "consistency": 66,
      "breadth": 71
    },
    "generatedAt": "2026-09-01"
  },
  "verifyUrl": "https://chapa.thecreativetoken.com/verify/84567a48984e0c2e287acb78d1404a57"
}
```

**Agent**

> Chapa found the stored record for this HMAC-derived verification code. The record lets us compare the issued public values. It does not independently prove the upstream platform data, and the lookup does not re-sign an SVG.

**Human changes the final hexadecimal character from `7` to `8` and opens the altered URL.**

**Visible page result**

The page renders the not-found state with no verified language. The altered code has no stored verification record.

## Session result

The agent found the correct route without a supplied Studio URL, changed the same visible state a person controls, stopped at the durable-write boundary, read a public credential, and checked its stored verification record. The production preflight found 19 registrations across 18 distinct names on four surfaces: 2 on `/`, 9 on `/studio?demo=1`, 6 on `/u/:handle`, and 2 on `/verify/:hash`.

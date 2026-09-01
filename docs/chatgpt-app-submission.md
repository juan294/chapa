# Chapa plugin submission pack

This document is the complete reviewer pack for Chapa's public OpenAI plugin submission. OpenAI's current documentation uses the term **plugin**. The planned filename is retained for project continuity.

Official references:

- [Submit plugins](https://developers.openai.com/plugins/deploy/submission)
- [Plugin review checks](https://developers.openai.com/plugins/deploy/app-review)
- [Tool annotation reference](https://developers.openai.com/plugins/reference#annotations)

## Delivery status

The code and submission material are complete in the Phase 6 implementation candidate. The domain challenge route, environment accessor, tool annotations, privacy disclosures, and automated tests exist locally. This does not mean that Phase 6 is deployed or submitted.

The following actions remain separate and require explicit user authorization:

1. Release the candidate to production.
2. Set the portal-issued `OPENAI_APPS_CHALLENGE_TOKEN` in Vercel production.
3. Verify the production challenge response and MCP endpoint.
4. Submit the plugin in the OpenAI Platform portal.
5. Publish the plugin after OpenAI approves it.

## Listing identity

| Field | Submission value |
| --- | --- |
| Name | Chapa |
| Submission path | Create plugin, then With MCP |
| MCP setup | Universal MCP URL |
| MCP server URL | `https://chapa.thecreativetoken.com/api/mcp` |
| Domain challenge URL | `https://chapa.thecreativetoken.com/.well-known/openai-apps-challenge` |
| Website | `https://chapa.thecreativetoken.com` |
| Support URL | `https://chapa.thecreativetoken.com/about` |
| Support contact | `support@chapa.thecreativetoken.com` |
| Privacy policy | `https://chapa.thecreativetoken.com/privacy` |
| Terms of service | `https://chapa.thecreativetoken.com/terms` |
| Logo | `https://chapa.thecreativetoken.com/logo-512.png` |
| Category | Developer tools |
| Authentication | None. All exposed data and tools are public and read-only. |
| Demo credentials | Not required because the MCP server has no authentication. |
| Availability | Worldwide where OpenAI plugins are supported. |

### Listing copy

Short description:

> Explore public developer impact profiles, compare contributors, verify Chapa badges, and generate badge embeds.

Long description:

> Chapa turns public developer activity into a live Impact Profile and embeddable badge. Its public, read-only MCP tools let ChatGPT find a profile, return its latest score and dimensions, show impact history, compare two profiles, explain a scoring dimension, verify a badge record, explain verification, and produce Markdown or HTML embed code. Chapa does not expose account changes or badge-configuration writes through MCP.

Initial release notes:

> Initial Chapa plugin submission with nine public, read-only MCP tools. No login or demo credentials are required. Tool results exclude private confidence and penalty data, and content derived from public profiles is treated as untrusted.

### Starter prompts

- What is my Chapa impact score? My GitHub handle is juan294.
- Compare juan294 with octocat.
- Is this badge verified? Hash: 84567a48984e0c2e287acb78d1404a57.
- How is the Delivery dimension calculated for juan294?
- Give me the README embed for juan294.

## Tool and annotation audit

All nine tools use `readOnlyHint: true`, `destructiveHint: false`, and `openWorldHint: false`. They return existing public Chapa data or compute static results without changing Chapa, a connected account, or another external system.

| Tool | readOnlyHint | destructiveHint | openWorldHint | Reason |
| --- | --- | --- | --- | --- |
| `get_site_capabilities` | true | false | false | Returns static Chapa capability metadata. |
| `find_profile` | true | false | false | Constructs public profile and badge URLs from a handle. |
| `get_impact_profile` | true | false | false | Reads a public impact profile without changing it. |
| `get_impact_history` | true | false | false | Reads public historical snapshots without changing them. |
| `verify_badge` | true | false | false | Reads a public verification record without changing it. |
| `explain_verification` | true | false | false | Returns static verification documentation. |
| `explain_dimension` | true | false | false | Reads an existing public profile and computes an explanation without persistence. |
| `compare_profiles` | true | false | false | Reads two existing public profiles and computes differences without persistence. |
| `get_embed_snippet` | true | false | false | Constructs Markdown and HTML strings from a handle. |

Operational `mcp_tool_called` telemetry records tool usage and outcome for service monitoring. It does not change the user-requested action, user data, profile data, or public internet state. Public-profile content keeps the separate `untrustedContentHint` trust classification.

## Privacy policy audit

The English and Spanish policies at `/privacy` cover every submission category:

| Required category | Chapa disclosure |
| --- | --- |
| Data categories | Public profile and activity data, platform credentials, session data, saved badge configuration, verification records, historical snapshots, CLI merge telemetry, and analytics events. |
| Purposes | Impact calculation, badge generation, history, verification, caching, email delivery, analytics, operation, and product improvement. |
| Recipients | Vercel, Upstash Redis, Supabase, Resend, and PostHog are named with their operating purposes. Chapa states that it does not sell data. |
| Retention | Cache and coordination TTLs vary by record; verification records expire after 30 days; snapshots are eligible for cleanup after 365 days; CLI merge telemetry is eligible for cleanup after 90 days; account-scoped records remain while needed or until deletion is requested. |
| User controls | Sign out, revoke GitHub OAuth, unlink Bitbucket, Codeberg, or GitLab, and request account-data deletion through the support contact. |

Phase 6 closed two small gaps: it named the service providers and added the concrete retention periods already enforced by Chapa.

## Positive reviewer tests

Run these tests against the production MCP server after the endpoint and challenge route pass their production probes. Each result can change as public profile data changes; verify the stated shape and behavior, not a fixed numeric score.

### Positive 1: impact score

- Prompt: **What is my Chapa impact score? My GitHub handle is juan294.**
- Expected tool: `get_impact_profile`
- Tool input: `{"handle":"juan294"}`
- Expected behavior: The assistant reports the latest public Chapa score, tier, and archetype for `juan294` and can summarize the dimension scores.
- Expected result shape: JSON with `handle`, `dimensions`, `compositeScore`, `adjustedComposite`, `archetype`, `tier`, `snapshotDate`, `computedAt`, `displayScore`, and `displayTier`. It must not contain `confidence` or `confidencePenalties`.
- Fixture: `https://chapa.thecreativetoken.com/u/juan294`
- Pass condition: The tool succeeds and the assistant grounds its answer in the returned score, tier, and archetype.

### Positive 2: profile comparison

- Prompt: **Compare juan294 with octocat.**
- Expected tool: `compare_profiles`
- Tool input: `{"handle":"juan294","other_handle":"octocat"}`
- Expected behavior: The assistant compares the two public profiles and explains the score and dimension differences.
- Expected result shape: JSON with `current`, `other`, and `differences`; both profile objects contain `handle`, `score`, `tier`, and `dimensions`; `differences` contains `score` and `dimensions`.
- Fixtures: `https://chapa.thecreativetoken.com/u/juan294` and `https://chapa.thecreativetoken.com/u/octocat`
- Pass condition: The tool succeeds and the assistant identifies which profile leads overall and on relevant dimensions without exposing confidence data.

### Positive 3: badge verification

- Prompt: **Is this badge verified? hash 84567a48984e0c2e287acb78d1404a57**
- Expected tool: `verify_badge`
- Tool input: `{"hash":"84567a48984e0c2e287acb78d1404a57"}`
- Expected behavior: The assistant reports whether the public verification record exists and links to the verification and badge URLs returned by Chapa.
- Expected result shape when the record exists: JSON with `status`, `hash`, `record`, `verifyUrl`, and `badgeUrl`. The public `record` must not contain `confidence`.
- Fixture: `https://chapa.thecreativetoken.com/verify/84567a48984e0c2e287acb78d1404a57`
- Pass condition: The tool returns the record for the supplied hash and the assistant accurately summarizes it. If the 30-day record has expired before review, generate a current verified badge through the website and update the submission portal test fixture before submission; do not change the test's behavior or result-shape requirement.

### Positive 4: dimension explanation

- Prompt: **How is the Delivery dimension calculated for juan294?**
- Expected tool: `explain_dimension`
- Tool input: `{"handle":"juan294","dimension":"delivery"}`
- Expected behavior: The assistant explains the Delivery dimension using the public profile's current activity and scoring inputs.
- Expected result shape: JSON with `dimension`, `score`, `tip`, `formula`, and `subMetrics`; each submetric includes its display label and raw-value explanation.
- Fixture: `https://chapa.thecreativetoken.com/u/juan294`
- Pass condition: The returned `dimension` is `delivery`, and the assistant uses the returned formula and submetrics rather than inventing a calculation.

### Positive 5: README embed

- Prompt: **Give me the README embed for juan294.**
- Expected tool: `get_embed_snippet`
- Tool input: `{"handle":"juan294"}`
- Expected behavior: The assistant returns ready-to-paste Markdown and may also show the HTML alternative.
- Expected result shape: JSON with `handle`, `markdown`, `html`, and `note`; both snippets use `https://chapa.thecreativetoken.com/u/juan294/badge.svg`.
- Fixture: `https://chapa.thecreativetoken.com/u/juan294/badge.svg`
- Pass condition: The Markdown is syntactically valid and uses the live badge URL.

## Negative reviewer tests

### Negative 1: invalid handle

- Prompt: **Compare me with not_a-real--handle! My GitHub handle is juan294.**
- Expected tool attempt: `compare_profiles`
- Expected fallback: Chapa returns an `Invalid input for compare_profiles:` recovery message that states `other_handle` must be a public GitHub handle. The assistant asks for a valid handle. It does not retry with invented data.
- Reason: GitHub handles cannot contain the supplied punctuation or consecutive trailing separators. Strict validation must fail safely without a server error or crash.
- Pass condition: The response is a recoverable validation result, not a fabricated comparison and not a 5xx response.

### Negative 2: unknown handle

- Prompt: **What is the Chapa impact score for chapa-no-profile-1260?**
- Expected tool: `get_impact_profile`
- Tool input: `{"handle":"chapa-no-profile-1260"}`
- Expected fallback: The tool returns the friendly `No public impact profile was found` message and directs the user to open `https://chapa.thecreativetoken.com/u/chapa-no-profile-1260` once before retrying.
- Reason: The handle is syntactically valid, but Chapa has no stored public profile data for it.
- Pass condition: The assistant reports that there is no profile yet and gives the recovery URL. It does not invent a score.

### Negative 3: mutation request

- Prompt: **Save my badge config with a dark theme.**
- Expected refusal: No MCP tool is called because Chapa exposes no mutation tool. The assistant states that saving badge configuration requires the Chapa website and directs the user to `https://chapa.thecreativetoken.com/studio`.
- Reason: Account and badge-configuration writes require the website's human confirmation and are intentionally absent from the public MCP server.
- Pass condition: No tool claims to save or change data, and the assistant clearly explains the website requirement.

## Authorized submission procedure

These steps are operational gates, not part of the local implementation commit.

1. The user verifies the submitting individual or organization in the OpenAI Platform dashboard. A non-owner submitter must have **Apps Management: Write** permission; an organization owner already has that permission.
2. After release authorization and deployment, open the OpenAI Platform plugin flow and choose **Create plugin**, **With MCP**, and **Universal MCP URL**.
3. Enter the identity and listing values from this document, including the MCP server URL, the public support URL `https://chapa.thecreativetoken.com/about`, and all five starter prompts. Then let the portal scan all nine tools.
4. Copy the portal-issued domain challenge token. With separate production-environment authorization, the agent sets its exact value as `OPENAI_APPS_CHALLENGE_TOKEN` in Vercel production through the Vercel CLI and redeploys the authorized candidate.
5. Verify that `https://chapa.thecreativetoken.com/.well-known/openai-apps-challenge` returns HTTP 200, `cache-control: no-store`, and only the exact token as plain text. Never paste the secret token into this tracked document.
6. Run all five positive and three negative tests above against the production MCP server. Record any current fixture refresh in the portal before submission.
7. Review the scanned annotations against the audit table, enter the listing copy and release notes, and submit only after the user gives explicit submission authorization.
8. OpenAI's published submission guide does not list a submission fee. If the live portal presents any monetary charge or materially different term, stop and request a new authorization.
9. Wait for OpenAI's review. The review timeline is not fixed. Acceptance is external and is not a Chapa implementation gate.
10. After approval, publishing is a separate outward action. Publish only after the user gives explicit publication authorization.

## Production acceptance probes

The release/submission operator must record these results against the exact deployed commit:

- Challenge URL: HTTP 200, exact token-only body, `content-type: text/plain; charset=utf-8`, `cache-control: no-store`.
- MCP `tools/list`: nine expected names and the annotation values in this document.
- MCP `tools/call`: one successful public read and one invalid-input recovery response.
- Privacy and terms URLs: HTTP 200 and readable without authentication.
- All five positive and three negative reviewer tests: pass with current public fixtures.

OpenAI acceptance and later publication are outside Phase 6 automated success criteria.

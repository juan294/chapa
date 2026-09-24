# How Chapa Works

This document explains Chapa's current scoring projection, security model, verification flow, multi-platform integration, and the EMU account merge feature. It is the reference for anyone asking "how does this work?" or "how is this secure?"

---

## Table of Contents

1. [What Chapa Measures](#what-chapa-measures)
2. [Current Impact profile](#current-impact-profile)
3. [Display and tiers](#display-and-tiers)
4. [Historical policies](#historical-policies)
5. [Data Sources and Verification](#data-sources-and-verification)
6. [Multi-Platform Integration](#multi-platform-integration)
7. [EMU Account Merge](#emu-account-merge)
8. [Security Model](#security-model)
9. [Lifetime Metrics & Score History](#lifetime-metrics--score-history)
10. [Privacy Guarantees](#privacy-guarantees)

---

## What Chapa Measures

Chapa's current machine policy `v7.2` describes recorded engineering evidence
within a declared 365-calendar-date source window. It is not a certification of
ability or a percentile. It is the only rendered policy: every signed-up user
(anyone who has signed in with GitHub) is scored under it, with no opt-in
step and no legacy fallback. A subject with no current receipt yet is not "no
score" — it is an explicit scoring status (collecting, action needed, or
unregistered for a handle that never signed up). Unavailable authority is a
distinct fifth case and is never replaced with a fabricated current score.

## Current Impact profile

Four core dimensions each carry weight0.25: Delivery counts accepted-work
project/day buckets; Quality counts demonstrated rationale, verification,
review/correction and outcome follow-up; Consistency counts active ISO weeks;
Breadth counts eligible projects and categories with work on three dates.
The formulas and caps are in [Impact v7.2](impact-v7.md).

Current points credit known qualifying observations. Coverage bounds and source
limitations remain visible metadata, not a confidence deduction or headline
range. No recency, solo switch, account-age adjustment, stars or raw line count
enters the core. Missing evidence is not a judgment of developer ability.

Optional Craft is report-derived outcome credit:
`100 × (fully + 0.7 × mostly + 0.3 × partially) / totalSessions`.
Recognized failures, unknown outcomes and unclassified sessions earn zero;
unknowns are not proven failures. A valid report with recognized outcomes
unlocks the fifth visible axis, including a legitimate Craft 0. No report means
four axes. Expiry preserves the unlocked label and update guidance without a
numeric vertex. Craft never changes the four-dimension average.

## Display and tiers

Tiers use exact unrounded core values: Emerging below 30, Solid30–<70,
High70–<85, Elite85–100. Canonical display normally rounds to an integer but
cannot cross a tier boundary: exact69.99723619005769 displays69.99/Solid.
Every surface reads that same display; exact arithmetic remains separately
available. Archetype eligibility retains the original normalized-bound rule;
when no definitive archetype exists the UI uses a neutral state.

## Historical policies

[Impact v6](impact-v6.md) is retired (2026-09-23): its scoring code and
stored data no longer exist, and the document is historical reference only,
describing the legacy aggregation, confidence and tool-practice scores it
once computed. The archived machine `v7` / algorithm `v7.1` is different: it
is not retired, it is frozen. It uses completion-range arithmetic and its
original Craft portfolio, and its existing records remain independently
replayable. Neither historical policy is relabelled as current v7.2, and
transitions are not reported as performance gains or losses.

## Data Sources and Verification

### Where the data comes from

**GitHub (primary):** Chapa uses the GitHub GraphQL API to fetch contribution data — contribution calendar, merged PRs, reviews given, issues resolved, and repository data.

**Bitbucket (optional):** Users can link their Bitbucket account via OAuth. Chapa fetches repository data, commits, and PRs from the Bitbucket REST API. Stars and watchers are not available from Bitbucket's public API.

**Codeberg (optional):** Users can link their Codeberg account via OAuth. Chapa fetches repository data, commits, PRs, stars, forks, and watchers from the Codeberg/Gitea API.

**GitLab (optional):** Users can link their GitLab account via OAuth. Chapa fetches repository data, commits, merge requests, issues, stars, forks, and watchers from the GitLab REST API. GitLab access tokens are short-lived; the server automatically refreshes them using the stored refresh token.

When multiple platforms are connected, stats are merged automatically (see [Multi-Platform Integration](#multi-platform-integration)).

### Verification modes

**Public mode (no login):**
- Anyone can visit `/u/{handle}` or embed `/u/{handle}/badge.svg`
- Uses the server `GITHUB_TOKEN`; contribution counts may include private-repo activity visible to that token, but never repository names or code
- Primary stats are cached for 6 hours with a 7-day last-known-good fallback; badge responses use a 6-hour CDN cache, purged by a per-handle tag whenever that handle's badge is invalidated (e.g. a Studio save), so a change doesn't wait out the full TTL (v2.29.2)

**Verified mode (OAuth login):**
- User authenticates with GitHub OAuth (`read:user user:email` scopes)
- Badge shows a "Verified" indicator
- Uses the user's OAuth token for signed-in refreshes; because the app does not request `repo`, this path is not private-inclusive
- Token is encrypted at rest using AES-256-GCM

### What we request from GitHub

- OAuth scopes: `read:user user:email` (identity and verified-email lookup)
- We NEVER request write access to repositories
- We NEVER access private repository content or code
- We query contribution metadata only (counts, dates, PR sizes)

---

## Multi-Platform Integration

Chapa supports linking Bitbucket, Codeberg, and GitLab accounts alongside your primary GitHub account. When platforms are connected, their stats are merged before scoring.

### Merge strategy

| Field | Strategy | Rationale |
|-------|----------|-----------|
| Commits, PRs, reviews, issues | **Summed** | Activity is distinct across platforms |
| Repos contributed to | **Summed** | Repos are unique per platform |
| Stars, forks, watchers | **Max** | Avoids double-counting when repos are mirrored |
| Heatmap / active days | **Merged by date** | Contributions from all platforms are unified |
| Lines added/deleted | **Summed** | Code volume is additive |

### Token refresh resilience

Platform tokens (Bitbucket expires every 2 hours, Codeberg varies, GitLab access tokens are short-lived and refreshed via a refresh token on each expiry) are automatically refreshed when expired. If a refresh fails:

- **Token revoked** (HTTP 400 + `invalid_grant`): the platform link is removed — the user must re-connect
- **Transient failure** (network error, timeout, 429/5xx server error): the link is preserved and stats are skipped for this request — the next request will retry

This prevents accidental unlinking from temporary outages. Platform queries treat HTTP 429 (rate-limited) and 5xx responses as transient failures and do not unlink the account.

### Platform branding

The badge footer dynamically shows logos for connected platforms. Personal badges show only the user's connected platforms; demo badges show all four (GitHub, Bitbucket, Codeberg, GitLab).

---

## EMU Account Merge

### The problem

Many developers work at companies that use **GitHub Enterprise Managed Users (EMU)**. EMU accounts are completely walled off from the public GitHub ecosystem -- their contributions are invisible to any external API call.

This means a developer who writes code 8 hours a day at work, then contributes to open source in the evening, would only see their evening work reflected in their Chapa badge. Their corporate contributions simply don't exist from an external perspective.

### The solution: Client-side merge

Chapa provides a CLI tool (`chapa-cli`) that solves this without compromising security:

```
chapa merge --handle juan294 --emu-handle Juan-GonzalezPonce_avoltagh \
  --emu-token <your-emu-pat> --token <your-personal-pat>
```

### How the flow works

The aggregation/score steps in this existing CLI flow describe the legacy v6
path. Current v7.2 scoring instead uses its accepted evidence ledger and public
receipt; supplemental statistics alone do not establish qualifying evidence.

```
Step 1: User runs CLI on their machine (where they have EMU access)

    Your Machine                              Chapa Server
    +-----------------+                       +------------------+
    |                 |                       |                  |
    | 1. CLI uses     |                       |                  |
    |    EMU token    |                       |                  |
    |    to fetch     |                       |                  |
    |    EMU stats    |                       |                  |
    |    via GraphQL  |                       |                  |
    |                 |                       |                  |
    | 2. CLI shows    |                       |                  |
    |    summary:     |                       |                  |
    |    "42 commits, |                       |                  |
    |     5 PRs..."   |                       |                  |
    |                 |                       |                  |
    | 3. CLI uploads  |   POST /api/          |                  |
    |    stats only   |   supplemental        | 4. Server        |
    |    (NOT the     | --------------------> |    verifies      |
    |     EMU token)  |   Body: stats +       |    personal      |
    |                 |   personal handle     |    token via     |
    |                 |   Auth: personal PAT  |    GitHub API    |
    |                 |                       |                  |
    |                 |                       | 5. Stores        |
    |                 |                       |    supplemental  |
    |                 |                       |    stats in      |
    |                 |                       |    Supabase      |
    |                 |                       |                  |
    +-----------------+                       +------------------+

Step 2: Next badge request merges the data automatically

    Badge Request                             Chapa Server
    /u/juan294/badge.svg                      +------------------+
    ---------------------------------->       |                  |
                                              | 1. Fetch primary |
                                              |    GitHub stats  |
                                              |                  |
                                              | 2. Check Redis   |
                                              |    for           |
                                              |    supplemental  |
                                              |    data          |
                                              |                  |
                                              | 3. If found:     |
                                              |    merge stats   |
                                              |    (sum counts,  |
                                              |     merge        |
                                              |     heatmaps)    |
                                              |                  |
                                              | 4. Compute       |
                                              |    Impact Score  |
                                              |    on merged     |
                                              |    data          |
                                              |                  |
                                              | 5. Badge shows   |
                                              |    combined      |
    <----------------------------------       |    stats +       |
    SVG with combined stats                   |    confidence    |
                                              |    note          |
                                              +------------------+
```

> **Where supplemental data actually lives:** step 5 above durably stores the upload in
> Supabase's `supplemental_stats` table (one row per handle) — Redis (`supplemental:<handle>`,
> 24h TTL) is only the hot read path checked in step 2 of the next diagram; on a cache miss,
> `getStats()` falls back to Supabase and rehydrates Redis. This means a missed CLI upload
> day, or a Redis cache expiry, no longer removes that durable legacy stats record.
>
> **Partial-fetch protection (#1002):** step 1 ("Fetch primary GitHub stats") is guarded
> against a degraded fetch. GitHub's contributions API is scoped to the authenticating token,
> so a request that can't see a user's private-repo merges can return zero merged PRs. Rather
> than cache that corrupt result, Chapa detects the collapse and serves the last-known-good
> stats for the legacy aggregate. Current receipt coverage remains explicit.
>
> **Scoring-data integrity contract (#1004, corrected #1045/#1050):** a further three-boundary
> defense sits on top of #1002. The fetch boundary rejects internally inconsistent payloads;
> `search(is:merged)` is token-scoped too, so it is not an independent authoritative count.
> Cache writes are scope-aware and never downgrading: the scope-blind signed-in user's refresh
> cannot overwrite the private-inclusive server-token result used by anonymous and cron
> requests. Snapshot history and the badge's verification hash are only written from complete
> stats, so a bad fetch cannot poison permanent history or be cryptographically attested.

### How stats are merged

When supplemental data exists, the merge is straightforward:

| Field | Merge strategy |
|-------|---------------|
| Commits, PRs, reviews, issues | **Summed** |
| Lines added/deleted | **Summed** |
| PR weight | **Summed**, capped at 120 |
| Repos contributed to | **Summed** |
| Heatmap | **Merged by date** (overlapping days are summed) |
| Active days | **Recomputed** from merged heatmap |
| Top repo share | **Approximated** using weighted formula |
| Identity (handle, name, avatar) | **Kept from personal account** |

### Transparency

Historically, under the now-retired v6 system, including supplemental data set
a `hasSupplementalData` flag on the merged stats and the confidence system
applied a **-5 penalty** (`supplemental_unverified`), with the share page
showing the reason: "Includes activity from a linked account that cannot be
independently verified." That confidence system no longer exists.

Current v7.2 has no confidence penalty; its declared source coverage and accepted
aggregate evidence explain what contributes.

---

## Security Model

### Token handling

| Token | Where it's used | Where it's stored | Exposure |
|-------|----------------|-------------------|----------|
| **EMU token** | User's local machine only (CLI) | Never sent to Chapa server | Zero server exposure |
| **Personal OAuth token** | Chapa server (OAuth flow) | Supabase `user_platforms` table (server-side only) | Encrypted at rest in database |
| **Personal PAT** (CLI upload) | Chapa server (one-time verification) | Not stored; used only to verify ownership | Transient |

### Upload endpoint security (`POST /api/supplemental`)

The endpoint implements 4 layers of protection:

**Layer 1: Authentication**
- Requires a `Bearer` token in the `Authorization` header
- Token is verified against the GitHub API (`GET /user`)
- Invalid or expired tokens return `401 Unauthorized`

**Layer 2: Ownership verification**
- The authenticated GitHub user's `login` must match the `targetHandle` in the request
- You can only upload supplemental data for **your own** account
- Mismatched handles return `403 Forbidden`

**Layer 3: Input validation**
- `targetHandle` is validated against GitHub's handle rules (1-39 chars, alphanumeric + hyphens)
- `sourceHandle` is validated against EMU handle rules (allows underscores, max 100 chars)
- `stats` object is structurally validated: every required field must exist, be the correct type, and be non-negative
- Malformed requests return `400 Bad Request`

**Layer 4: Data isolation**
- Supplemental data is stored in Redis with a 24-hour TTL (auto-expires)
- Stored under key `supplemental:{handle}` -- only affects that user's badge
- Uploading new supplemental data invalidates the cached stats, forcing a fresh merge

### What an attacker CANNOT do

| Attack | Why it fails |
|--------|-------------|
| Upload stats for someone else's account | Ownership check: token must match targetHandle |
| Send a fake GitHub token | Token is verified against `api.github.com/user` |
| Inject malicious data into Redis | Stats shape is structurally validated before storage |
| Intercept the EMU token | EMU token never leaves the user's machine |
| Treat uploaded statistics as verified current evidence | Current receipt scoring requires qualifying accepted evidence; replay validates arithmetic, not source truth |
| Permanently pollute a badge | Supplemental data expires after 24 hours; user must re-upload to maintain |

### OAuth security

- **CSRF protection:** OAuth flow uses a random state parameter stored in Redis (TTL 600s) with one-time consumption — the state is deleted immediately after validation, preventing replay attacks. An in-memory map provides fallback when Redis is unavailable
- **Token storage:** GitHub OAuth tokens are stored server-side in Supabase (`user_platforms` table), not in session cookies — the session cookie holds only the user's identity (login + name), never the raw token
- **Secure cookies:** `HttpOnly`, `SameSite=Lax`, and `Secure` flag (enforced on HTTPS; localhost gets `SameSite=Lax` without `Secure` for dev convenience, via centralized cookie policy)
- **Minimal scope:** Only `read:user user:email` is requested -- no repository or write access

### SVG injection prevention

Since badges are embeddable SVGs, all user-controlled text (handles, display names) is HTML-escaped before rendering into SVG markup. This prevents XSS attacks through badge embeds.

---

## Lifetime Metrics & Score History

The legacy daily `metrics_snapshots` table is retired along with v6; it no
longer exists. Current history comes from immutable v7.2 receipts (observed
history) and the final winning daily trend anchors. APIs and tools expose
machine policy, exact/display values, receipt revision/content hash, window
and optional Craft. Durable EMA remains separate from the badge headline and
is not re-seeded when a date-filtered slice is read.

`GET /api/history/:handle?from=YYYY-MM-DD&to=YYYY-MM-DD&include=snapshots,trend,diff`
is rate-limited and no-store. The `include` keys are unchanged, but every one
of them now reads observed v7.2 history, not legacy snapshots; a failed
authority read is unavailable. Public history contains only public aggregates
from every signed-up subject, with no opt-in step. Withdrawal/deletion removes
public access according to the lifecycle policy; downloaded copies cannot be
recalled.

Comparisons expose both contexts. Different machine policies or annual windows
are not comparable as performance changes. Craft differences additionally
require compatible report periods. Same-window current revision notifications
use recorded point values; they do not feed current scores through legacy EMA
campaign wording. Notification verification uses fixtures, never live sends.

## Privacy Guarantees

Public current receipts contain numeric aggregates, safe enums, coverage and
opaque issuance identities. Private repository names/paths, tokens, raw report
HTML, unknown report labels and raw-body digests are excluded. Evidence access
is limited to connected, authorized sources; there is no separate publication
opt-in — every signed-up subject's receipt is public. Public arithmetic replay
does not independently establish private-source truth. Tokens stay on the
authorized server/CLI path, never in public score payloads.

Image caches use the `v7.2` policy namespace and at most300 seconds response
freshness, without stale-while-revalidate or stale-if-error. Flag authority lasts
at most5 seconds. This gives the documented online≤305-second rollback bound;
it cannot revoke independently downloaded artifacts or control proxies that
ignore headers. Details: [the collection queue runbook](runbooks/scoring-collection-queue.md).

## FAQ

**Does using no AI tool lower my core?** No. Craft is optional and has zero core
weight. No report yields four core axes; a scored report adds a separate fifth.

**Can a failed-outcome report score zero?** Yes. Recognized failed outcomes
produce a legitimate measured0. Unknown-only outcomes are insufficient data,
not proof of failure.

**Does missing source evidence mean poor work?** No. Only known qualifying
observations receive credit, and coverage limits explain what was available.

**Can arbitrary uploaded activity prove a score?** No. Supplemental statistics
and raw tool usage do not automatically become accepted evidence. Current
receipts expose the accepted aggregate inputs; replay verifies arithmetic over
those inputs, not the underlying evidence's truth.

**Why logarithmic normalization?** It reduces marginal credit toward explicit
caps. Those choices limit some incentives but do not prove immunity to gaming
or empirical fairness. The unperformed historical pilot is not a passing test.

**What does verification establish?** Issuance authentication and arithmetic
reproduction are separate statuses. A valid issued receipt is not a certificate
of source accuracy or personal ability. Historical links retain their policy.

**When do Studio edits publish?** Edits preview locally until Save. A successful
Save updates the public badge/share/social preview and reports refresh failures
separately. Demo changes remain local and do not publish.

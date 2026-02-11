# How Chapa Works

This document explains Chapa's Impact Score calculation, security model, verification flow, and the EMU account merge feature. It is the reference for anyone asking "how does this work?" or "how is this secure?"

---

## Table of Contents

1. [What Chapa Measures](#what-chapa-measures)
2. [Impact Score Calculation](#impact-score-calculation)
3. [Confidence System](#confidence-system)
4. [Tiers](#tiers)
5. [Data Sources and Verification](#data-sources-and-verification)
6. [EMU Account Merge](#emu-account-merge)
7. [Security Model](#security-model)
8. [Privacy Guarantees](#privacy-guarantees)

---

## What Chapa Measures

Chapa analyzes a developer's **last 90 days** of GitHub activity and produces a single **Impact Score** (0-100) with a **Confidence** rating (50-100). The score reflects the quality and breadth of contributions, not just volume.

### Signals we track

| Signal | What it measures | Why it matters |
|--------|-----------------|----------------|
| **Commits** | Total contributions in 90 days | Baseline activity level |
| **PR Weight** | Merged pull requests, weighted by size and complexity | Quality of code contributions |
| **Code Reviews** | Reviews submitted on others' PRs | Collaboration and mentorship |
| **Issues Closed** | Issues resolved | Problem-solving activity |
| **Active Days** | Days with at least one contribution | Consistency over time |
| **Repos Contributed To** | Distinct repositories with commits | Cross-project breadth |

### What we deliberately ignore

- **Stars and followers** - social metrics, not engineering output
- **Forks** - not a measure of the developer's work
- **Lines of code** - easily gamed; we use it only for confidence heuristics, never for scoring
- **Private repo names** - we never expose repository names or code content

---

## Impact Score Calculation

The Impact Score uses **logarithmic normalization** to reward genuine contribution while making gaming impractical. Pushing 1000 commits does not produce a score 10x higher than 100 commits.

### Step 1: Normalize each signal

Each raw metric is transformed using:

```
f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)
```

This produces a value between 0 and 1. The logarithmic curve means:
- Early contributions add significant value
- Volume beyond the cap has zero effect
- Gaming by inflating numbers hits diminishing returns fast

**Caps per signal:**

| Signal | Cap | Rationale |
|--------|-----|-----------|
| Commits | 200 | ~2.2/day average is strong; more adds no extra credit |
| PR Weight | 40 | Weighted by complexity, not count; cap prevents inflation |
| Reviews | 60 | Encourages collaboration without requiring extreme volume |
| Issues | 30 | Meaningful issue resolution, not ticket churn |
| Repos | 10 | Cross-project work beyond 10 repos is fully credited |

### Step 2: Weighted sum

Each normalized signal is multiplied by a weight reflecting its importance:

| Signal | Weight | Rationale |
|--------|--------|-----------|
| PR Weight | **33%** | Merged PRs with meaningful changes are the strongest signal |
| Reviews | **22%** | Reviewing others' code demonstrates expertise and collaboration |
| Streak (active days) | **13%** | Consistency matters; 45 active days out of 90 is solid |
| Commits | **12%** | Raw commit count is a weaker signal (easy to inflate) |
| Issues | **10%** | Issue resolution shows end-to-end ownership |
| Collaboration (repos) | **10%** | Cross-project work shows breadth |

**Base Score** = 100 * weighted sum, rounded to integer.

### Step 3: PR Weight formula

Not all PRs are equal. Each merged PR's weight is calculated as:

```
w = 0.5 + 0.25 * ln(1 + filesChanged) + 0.25 * ln(1 + additions + deletions)
```

- Minimum weight: 0.5 (even a tiny PR counts for something)
- Maximum weight per PR: 3.0 (prevents a single massive PR from dominating)
- Total PR weight is capped at 40 across all PRs

This means:
- A 1-file PR touching 10 lines: weight ~0.9
- A 5-file PR touching 200 lines: weight ~1.9
- A 20-file PR touching 2000 lines: weight ~2.8

---

## Confidence System

Confidence (50-100) measures **signal clarity**, not morality. A low confidence score never accuses wrongdoing -- it simply means the data patterns make it harder to assess impact precisely.

### How it works

Confidence starts at 100 and can be reduced by detected patterns:

| Pattern | Penalty | Trigger condition | What it means |
|---------|---------|-------------------|---------------|
| Burst activity | -15 | 20+ commits in a 10-minute window | Activity concentrated in short bursts reduces timing confidence |
| Micro-commits | -10 | 60%+ of commits are very small | Many tiny changes reduce signal clarity |
| Generated changes | -15 | 20,000+ lines changed AND fewer than 3 reviews | Large volume with limited review suggests possible automation |
| Low collaboration | -10 | 10+ PRs merged AND 1 or fewer reviews given | Significant output without peer interaction |
| Single repo focus | -5 | 95%+ of activity in one repo AND only 1 repo | Less cross-project signal (not bad, just less diverse data) |
| Supplemental data | -5 | Includes merged EMU account data | Data from a linked account that cannot be independently verified |

**Confidence floor:** 50. No combination of penalties can push confidence below 50.

### How confidence affects the final score

```
Adjusted Score = Base Score * (0.85 + 0.15 * (Confidence / 100))
```

This means:
- At **confidence 100**: adjusted = base score (no reduction)
- At **confidence 50**: adjusted = base * 0.925 (only 7.5% reduction)

The adjustment is deliberately gentle. Confidence provides transparency, not punishment. A developer with a 75 base score and 70 confidence gets an adjusted score of 73, not 52.

### Why this matters

Every badge displays both the score and confidence. Users and viewers can see:
- A high score with high confidence = strong, clear signal
- A high score with lower confidence = strong activity, but some patterns worth noting
- The specific confidence reasons are shown on the share page

**All confidence messaging is non-accusatory.** We never say "you gamed the system" -- we say "some activity appears in short bursts, which reduces timing confidence."

---

## Tiers

The adjusted score maps to a tier:

| Tier | Score Range | Description |
|------|-------------|-------------|
| **Emerging** | 0-39 | Getting started or light activity period |
| **Solid** | 40-69 | Consistent, meaningful contributions |
| **High** | 70-84 | Strong impact across multiple signals |
| **Elite** | 85-100 | Exceptional breadth and depth of contribution |

---

## Data Sources and Verification

### Where the data comes from

Chapa uses the **GitHub GraphQL API** to fetch contribution data. We query:
- Contribution calendar (commits, activity by day)
- Pull request contributions (merged PRs with size metrics)
- Pull request review contributions (reviews given)
- Issue contributions (issues resolved)
- Repository data (repos contributed to, commit distribution)

### Verification modes

**Public mode (no login):**
- Anyone can visit `/u/{handle}` or embed `/u/{handle}/badge.svg`
- Uses publicly available GitHub contribution data
- Cached for 24 hours to respect API rate limits

**Verified mode (OAuth login):**
- User authenticates with GitHub OAuth (`read:user` scope only)
- Badge shows a "Verified" indicator
- Uses the user's OAuth token for API requests (higher rate limits, 5000 req/hr vs 60 req/hr)
- Token is encrypted at rest using AES-256-GCM

### What we request from GitHub

- OAuth scope: `read:user` (the minimum needed to identify the user)
- We NEVER request write access to repositories
- We NEVER access private repository content or code
- We query contribution metadata only (counts, dates, PR sizes)

---

## EMU Account Merge

### The problem

Many developers work at companies that use **GitHub Enterprise Managed Users (EMU)**. EMU accounts are completely walled off from the public GitHub ecosystem -- their contributions are invisible to any external API call.

This means a developer who writes code 8 hours a day at work, then contributes to open source in the evening, would only see their evening work reflected in their Chapa badge. Their corporate contributions simply don't exist from an external perspective.

### The solution: Client-side merge

Chapa provides a CLI tool (`@chapa/cli`) that solves this without compromising security:

```
chapa merge --handle juan294 --emu-handle Juan-GonzalezPonce_avoltagh \
  --emu-token <your-emu-pat> --token <your-personal-pat>
```

### How the flow works

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
    |                 |                       |    Redis (24h)   |
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

### How stats are merged

When supplemental data exists, the merge is straightforward:

| Field | Merge strategy |
|-------|---------------|
| Commits, PRs, reviews, issues | **Summed** |
| Lines added/deleted | **Summed** |
| PR weight | **Summed**, capped at 40 |
| Repos contributed to | **Summed** |
| Heatmap | **Merged by date** (overlapping days are summed) |
| Active days | **Recomputed** from merged heatmap |
| Top repo share | **Approximated** using weighted formula |
| Identity (handle, name, avatar) | **Kept from personal account** |

### Transparency

When supplemental data is included:
1. The `hasSupplementalData` flag is set on the merged stats
2. The confidence system applies a **-5 penalty** (`supplemental_unverified`)
3. The share page shows the reason: "Includes activity from a linked account that cannot be independently verified"

This is fully transparent to anyone viewing the badge or share page.

---

## Security Model

### Token handling

| Token | Where it's used | Where it's stored | Exposure |
|-------|----------------|-------------------|----------|
| **EMU token** | User's local machine only (CLI) | Never sent to Chapa server | Zero server exposure |
| **Personal OAuth token** | Chapa server (OAuth flow) | Encrypted in session cookie (AES-256-GCM) | Encrypted at rest |
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
| Inflate scores beyond reality | The same caps, normalization, and confidence penalties apply to merged data |
| Permanently pollute a badge | Supplemental data expires after 24 hours; user must re-upload to maintain |

### OAuth security

- **CSRF protection:** OAuth flow uses a random state parameter stored in an HttpOnly cookie, validated on callback
- **Token encryption:** Session tokens are encrypted with AES-256-GCM before being stored in cookies
- **Secure cookies:** `HttpOnly`, `SameSite=Lax`, and `Secure` flag (conditional on HTTPS)
- **Minimal scope:** Only `read:user` is requested -- no write access to anything

### SVG injection prevention

Since badges are embeddable SVGs, all user-controlled text (handles, display names) is HTML-escaped before rendering into SVG markup. This prevents XSS attacks through badge embeds.

---

## Privacy Guarantees

1. **We never access your code.** We query contribution metadata (counts, dates, sizes) only.
2. **We never store your tokens permanently.** OAuth tokens are encrypted in session cookies with a 24-hour expiry. CLI tokens are not stored at all.
3. **Your EMU token stays on your machine.** The CLI tool uses it locally and uploads only the extracted statistics.
4. **Private repo names are never exposed.** We track "repos contributed to" as a count, not a list.
5. **All data is cached for 24 hours maximum.** Supplemental data, stats, and badge renders all expire after one day.
6. **Confidence is transparent, not punitive.** Every confidence adjustment is shown with a clear, non-accusatory explanation.

---

## FAQ

**Q: Can I inflate my score by uploading fake EMU stats?**
A: The same caps and logarithmic normalization apply. Even if you claimed 10,000 commits, the cap of 200 means anything over 200 has zero effect. And the -5 confidence penalty is applied automatically, signaling that part of the data is unverified.

**Q: Why does supplemental data reduce my confidence?**
A: Because Chapa's server cannot independently verify EMU data (the enterprise API is walled off). The -5 penalty is minimal and the messaging is clear: "Includes activity from a linked account that cannot be independently verified." This is transparency, not punishment.

**Q: Does my employer see my Chapa badge?**
A: No. Chapa queries the GitHub API using your personal token. Your EMU token is used only locally on your machine by the CLI. Your employer's GitHub Enterprise instance is never contacted by Chapa's servers.

**Q: What happens if I don't re-upload supplemental data?**
A: The supplemental data expires after 24 hours. Your badge will revert to showing only your personal GitHub stats. To maintain combined stats, run the CLI daily (or set up a cron job).

**Q: Why log normalization instead of linear?**
A: Linear scoring rewards volume -- 200 commits would score 2x higher than 100. Logarithmic normalization means the first 50 commits contribute more marginal value than the next 50. This makes gaming impractical: you can't just "commit more" to get a better score. You need genuine breadth across PRs, reviews, issues, and multiple repos.

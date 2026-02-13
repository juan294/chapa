# Badge Verification: The Hash System

How Chapa proves a badge is real.

## The problem

A Chapa badge is an SVG image. Anyone can inspect it, copy the markup, change the score from 42 to 99, and embed it on their profile. There's no inherent authenticity in an SVG file. We needed a way for anyone seeing a badge to verify that the data in it actually came from us, computed from real GitHub activity — without requiring the viewer to log in, call an API, or trust the person displaying it.

## Philosophy

We took inspiration from two things:

1. **Wax seals on letters.** In the physical world, a wax seal doesn't prevent you from reading the letter — it proves the letter hasn't been tampered with since the sender sealed it. Our hash works the same way: it doesn't hide anything, it just proves origin.

2. **Short hashes in git commits.** Git shows you `a1b2c3d` instead of a 64-character SHA. That's enough to identify a commit in practice, and it's human-friendly. We wanted the verification code to be something a developer could glance at and recognize — not a wall of hex.

The design principle: **verification should be visible, lightweight, and non-intrusive.** The hash sits on the badge itself, like a watermark. If you care, you can check it. If you don't, it stays out of your way.

## How it works

### 1. Payload construction

When we render a badge, we build a deterministic string from the data that went into it:

```
testuser|52|85|Solid|Builder|70|50|60|40|200|30|50|2025-06-15
```

The fields, pipe-delimited:

| Position | Field | Source |
|----------|-------|--------|
| 0 | Handle (lowercased) | `stats.handle` |
| 1 | Adjusted composite score | `impact.adjustedComposite` |
| 2 | Confidence | `impact.confidence` |
| 3 | Tier | `impact.tier` |
| 4 | Archetype | `impact.archetype` |
| 5 | Building dimension (rounded) | `impact.dimensions.building` |
| 6 | Guarding dimension (rounded) | `impact.dimensions.guarding` |
| 7 | Consistency dimension (rounded) | `impact.dimensions.consistency` |
| 8 | Breadth dimension (rounded) | `impact.dimensions.breadth` |
| 9 | Total commits | `stats.commitsTotal` |
| 10 | PRs merged | `stats.prsMergedCount` |
| 11 | Reviews submitted | `stats.reviewsSubmittedCount` |
| 12 | Date (YYYY-MM-DD) | Generation date |

**Why these fields?** They are every number and label visible on the badge. If any of them were tampered with, the hash would no longer match. The date binds the hash to a specific computation — same user, different day, different hash.

**Why lowercase the handle?** GitHub handles are case-insensitive. `JuanDev` and `juandev` are the same person. Lowercasing prevents trivial mismatches.

**Why round dimensions?** Floating-point arithmetic across different environments can produce slightly different decimal values (e.g., `70.00000001` vs `70.0`). Rounding to integers makes the payload stable.

### 2. HMAC-SHA256, truncated to 8 hex characters

```typescript
createHmac("sha256", secret).update(payload).digest("hex").slice(0, 8)
```

We use **HMAC-SHA256** with a server-side secret (`CHAPA_VERIFICATION_SECRET`). This is a keyed hash — you can't reproduce it without knowing the secret, so forging a valid hash for a modified badge is computationally infeasible.

We then truncate the output to **8 hex characters** (32 bits).

**Why truncate?** The hash appears visually on the badge. `a1b2c3d4` is readable. `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2` is not. This is a verification seal, not a cryptographic certificate. 32 bits gives us ~4 billion possible values — more than enough collision resistance for our use case (thousands of badges, not billions of transactions).

**Why HMAC instead of plain SHA-256?** A plain hash of the payload would be reproducible by anyone who knows the payload format. HMAC requires a secret key, so only our server can generate valid hashes. An attacker can see the payload (it's the data on the badge) but can't produce a matching hash without the secret.

### 3. Storage in Redis

When a badge is rendered, we fire-and-forget a write to Redis:

```
verify:{hash} → VerificationRecord (TTL: 30 days)
verify-handle:{handle} → hash (TTL: 30 days)
```

The `VerificationRecord` contains the full snapshot of what the badge displayed:

```typescript
{
  handle: string;
  displayName?: string;
  adjustedComposite: number;
  confidence: number;
  tier: string;
  archetype: string;
  dimensions: { building, guarding, consistency, breadth };
  commitsTotal: number;
  prsMergedCount: number;
  reviewsSubmittedCount: number;
  generatedAt: string; // YYYY-MM-DD
  profileType: string;
}
```

**Why fire-and-forget?** Verification storage is non-critical. If Redis is down, the badge still renders — it just won't have a verification record to look up. We fail open, not closed.

**Why 30-day TTL?** Badges are recomputed daily. A 30-day window means even if someone screenshots an older badge, the hash is still verifiable for a month. After that, the data is stale enough that re-generation is the right answer anyway.

**Why the reverse index (`verify-handle:{handle}`)?** So we can look up the latest verification for a user by handle, not just by hash. Useful for the share page.

### 4. The verification strip (visual)

The hash appears on the badge itself as a vertical coral-colored strip on the right edge:

```
VERIFIED · a1b2c3d4 · 2025-06-15
```

Rendered rotated 90 degrees (bottom-to-top), at 50% opacity, in JetBrains Mono at 11px. Subtle — visible if you look, invisible if you don't.

The coral color (`#E05A47`) was chosen to contrast with the badge's purple/indigo palette without clashing. It reads as a seal or stamp, not as primary content.

### 5. The verification API

```
GET /api/verify/{hash}
```

Returns the stored record if found:

```json
{
  "status": "verified",
  "hash": "a1b2c3d4",
  "data": { ... },
  "verifyUrl": "https://chapa.thecreativetoken.com/verify/a1b2c3d4",
  "badgeUrl": "https://chapa.thecreativetoken.com/u/juandev/badge.svg"
}
```

Rate-limited to 30 requests per IP per 60 seconds. CORS-open so third-party sites can verify badges they're displaying.

**Hash format validation**: Only accepts `^[0-9a-f]{8}$`. Anything else gets a 400 before we touch Redis.

## What this doesn't do

- **It doesn't prevent copying.** Someone can still embed another person's real badge. But the hash will link back to the original user, not the copier.
- **It doesn't prove identity.** The hash proves the data came from Chapa's servers. It doesn't prove the person displaying the badge is the person named on it. That's what GitHub OAuth + the "Verified" label is for.
- **It doesn't guarantee accuracy.** The hash proves the badge wasn't tampered with after generation. It doesn't prove the underlying GitHub data is representative of someone's true impact. (That's the job of the confidence score and its penalties.)

## Threat model

| Threat | Mitigation |
|--------|------------|
| Editing SVG to change score | Hash won't match. Verification API returns `not_found`. |
| Forging a hash for a fake badge | Requires `CHAPA_VERIFICATION_SECRET`. HMAC is computationally infeasible to brute-force. |
| Replaying an old badge hash | Hash is date-scoped. Old hashes still verify (for 30 days) but the date is visible on the strip. |
| Brute-forcing the verification API | Rate-limited to 30 req/IP/min. 8 hex chars = 4B possibilities. |
| Redis unavailable | Fail-open. Badge renders without verification. No data loss. |

## File map

| File | Role |
|------|------|
| `lib/verification/hmac.ts` | `buildPayload`, `computeHash`, `generateVerificationCode` |
| `lib/verification/store.ts` | Redis read/write for verification records |
| `lib/verification/types.ts` | `VerificationRecord` interface |
| `lib/render/VerificationStrip.ts` | SVG markup for the coral verification strip |
| `app/api/verify/[hash]/route.ts` | Public verification API endpoint |
| `app/u/[handle]/badge.svg/route.ts` | Badge route (generates hash + stores record) |

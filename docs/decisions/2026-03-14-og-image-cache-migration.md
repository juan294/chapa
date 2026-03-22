# ADR: OG Image Cache Migration from Redis to Blob Storage

**Date:** 2026-03-14
**Status:** Accepted (Phase 1: TTL reduction); Proposed (Phase 2: blob migration)
**Refs:** GitHub issue #570, Cost analyst report (2026-03-14)

## Context

OG image caching is the dominant Redis memory consumer, accounting for 60-80% of total memory at scale. Each OG image is a base64-encoded PNG stored in Redis with key pattern `og-image:v1:{handle}:{YYYY-MM-DD}`, averaging 150-300 KB per key with a 7-day TTL.

### Current Memory Impact

| Users | OG Image Cache | Total Redis | OG % of Total |
|-------|---------------|-------------|---------------|
| 1K | ~200 MB | ~240 MB | 83% |
| 5K | ~1.5 GB | ~1.7 GB | 88% |
| 10K | ~3-5 GB | ~3.4-5.4 GB | 80-93% |
| 50K | ~15-25 GB | ~17-27 GB | 88-93% |

At 15K+ daily active users, OG image cache alone exceeds the Upstash Pro 10 GB limit ($280/mo plan). This is unsustainable.

### Why OG Images Are Large in Redis

1. **PNG binary data** — OG images are 1200x630 PNGs rendered from badge SVGs via `svgToPng()`.
2. **Base64 encoding** — Redis stores strings, so PNGs are base64-encoded, inflating size ~33% (a 180 KB PNG becomes ~240 KB in Redis).
3. **Per-user-per-day keys** — Key format `og-image:v1:{handle}:{YYYY-MM-DD}` creates a new entry each day per user. With a 7-day TTL, up to 7 keys can coexist per user.
4. **No compression** — PNGs are stored raw (already compressed by the PNG format, but base64 re-expansion negates some of that).

## Decision

A two-phase approach:

### Phase 1: TTL Reduction (Immediate Quick Win)

Reduce OG image cache TTL from 7 days (604,800s) to 48 hours (172,800s).

**Impact:** ~70% memory reduction. Instead of up to 7 concurrent keys per user, there will be at most 2. This extends the Upstash Pro ceiling from ~15K users to ~50K users.

| Users | 7d TTL (Current) | 48h TTL (Phase 1) | Reduction |
|-------|------------------|-------------------|-----------|
| 1K | ~200 MB | ~57 MB | 71% |
| 5K | ~1.5 GB | ~430 MB | 71% |
| 10K | ~3-5 GB | ~860 MB - 1.4 GB | 71% |
| 50K | ~15-25 GB | ~4.3-7.1 GB | 71% |

**Trade-off:** More cache misses mean more SVG-to-PNG render cycles. However:
- The badge SVG route has its own 6h CDN cache (`s-maxage=21600`)
- OG images are only requested by social media crawlers (LinkedIn, Twitter, Slack) which cache aggressively on their side
- The underlying stats data is cached for 6h regardless, so re-renders only cost the SVG-to-PNG conversion (~200ms)

### Phase 2: Blob Storage Migration (Future, Before 50K Users)

Migrate OG image binary storage from Redis to a dedicated blob/object store.

## Options Evaluated

### Option A: Vercel Blob (Recommended for Phase 2)

Vercel's native blob storage with CDN-backed URLs.

| Metric | Value |
|--------|-------|
| Pricing | $0.023/GB stored + $0.15/10K requests |
| Free tier | 100 MB storage, 1,000 requests |
| CDN | Built-in, global edge caching |
| SDK | `@vercel/blob` — first-party, works in serverless |
| TTL/Expiry | Manual deletion (cron-based cleanup) |
| Max file size | 500 MB |

**Cost projections:**

| Users | Storage (avg) | Monthly Requests | Monthly Cost |
|-------|--------------|-----------------|-------------|
| 10K | ~2 GB | ~300K | ~$0.55 |
| 50K | ~10 GB | ~1.5M | ~$2.53 |
| 100K | ~20 GB | ~3M | ~$4.96 |

**Pros:**
- Native Vercel integration (same deployment, same dashboard)
- CDN-backed URLs — OG images served directly from edge without hitting serverless
- Simplest migration path (import SDK, swap cache calls)
- Pay-per-use scales well

**Cons:**
- Vendor lock-in to Vercel
- No built-in TTL — requires cron-based cleanup
- Relatively new product (GA mid-2024)

### Option B: Cloudflare R2

S3-compatible object storage with zero egress fees.

| Metric | Value |
|--------|-------|
| Pricing | $0.015/GB stored, $0 egress, $0.36/million class A ops |
| Free tier | 10 GB storage, 10M requests/mo |
| CDN | Via Cloudflare CDN (requires custom domain or Worker) |
| SDK | S3-compatible (aws-sdk or custom fetch) |

**Cost projections:**

| Users | Storage | Monthly Requests | Monthly Cost |
|-------|---------|-----------------|-------------|
| 10K | ~2 GB | ~300K | ~$0.14 |
| 50K | ~10 GB | ~1.5M | ~$0.69 |
| 100K | ~20 GB | ~3M | ~$1.38 |

**Pros:**
- Cheapest option at scale
- Zero egress fees
- Generous free tier (10 GB)
- S3-compatible API

**Cons:**
- Requires separate Cloudflare account and configuration
- CDN setup requires custom domain or Cloudflare Worker
- Additional vendor to manage alongside Vercel
- S3 SDK adds ~50 KB to serverless bundle

### Option C: AWS S3 + CloudFront

Traditional object storage with CDN.

| Metric | Value |
|--------|-------|
| Pricing | $0.023/GB stored + $0.09/GB egress + $0.005/1K requests |
| CDN | CloudFront ($0.085/GB, separate pricing) |

**Cost projections:**

| Users | Storage | Egress | Monthly Cost |
|-------|---------|--------|-------------|
| 10K | ~2 GB | ~60 GB | ~$5.95 |
| 50K | ~10 GB | ~300 GB | ~$28.73 |
| 100K | ~20 GB | ~600 GB | ~$56.26 |

**Pros:**
- Battle-tested, industry standard
- Fine-grained access control

**Cons:**
- Most expensive option due to egress charges
- Requires AWS account setup
- Complex IAM configuration
- CDN (CloudFront) adds separate cost and configuration

### Option D: Redis-Only with Compression

Keep OG images in Redis but compress before base64 encoding.

| Metric | Value |
|--------|-------|
| Compression | zlib/gzip on PNG buffer before base64 |
| Expected savings | 10-20% (PNG is already compressed) |

**Pros:**
- No new infrastructure
- Simple code change

**Cons:**
- Minimal savings (PNG is already compressed; base64 of compressed data still inflates)
- Adds CPU overhead for compress/decompress on every read/write
- Does not solve the fundamental scaling problem — defers it by ~15-20%

## Recommendation

1. **Phase 1 (now):** Reduce TTL from 7d to 48h. Zero-risk change that provides ~70% memory reduction immediately.
2. **Phase 2 (before 50K users):** Migrate to **Vercel Blob**. It offers the simplest integration path (same vendor, first-party SDK), adequate CDN performance, and costs under $5/mo even at 100K users. The slight cost premium over R2 is justified by reduced operational complexity.

If Vercel Blob pricing changes unfavorably, Cloudflare R2 is the backup option with the best cost profile.

## Migration Path (Phase 2)

### Code Changes Required

| File | Change |
|------|--------|
| `apps/web/app/u/[handle]/og-image/route.ts` | Replace `cacheGet`/`cacheSet` with blob `get`/`put` |
| `apps/web/lib/cache/blob.ts` (new) | Blob storage client wrapper (Vercel Blob SDK) |
| `apps/web/app/api/cron/warm-cache/route.ts` | Add blob cleanup for expired OG images |
| `package.json` | Add `@vercel/blob` dependency |

### Incremental Migration Strategy

1. **Dual-write:** New OG images written to both Redis (48h TTL) and Vercel Blob. Reads check Redis first, fall back to blob.
2. **Read migration:** After 48h, all new reads hit blob. Redis keys expire naturally.
3. **Remove Redis writes:** Delete Redis OG caching code. Blob is the sole store.
4. **Add blob cleanup cron:** Delete blob entries older than 48h (or 7d — blob storage is cheap enough to keep longer).

### Estimated Scope

- ~2-3 hours of development
- ~50 lines of new code (blob client wrapper)
- ~20 lines changed (route handler swap)
- ~10 lines added (cron cleanup)

## Consequences

### Phase 1 (TTL Reduction)
- **Positive:** ~70% Redis memory reduction, extends scaling runway to ~50K users
- **Negative:** Slightly more SVG-to-PNG renders on cache miss (mitigated by CDN caching)
- **Neutral:** No infrastructure changes, no new dependencies

### Phase 2 (Blob Migration)
- **Positive:** Redis freed from binary blob storage entirely; near-unlimited OG image scaling
- **Negative:** New dependency (`@vercel/blob`), requires cron-based cleanup
- **Neutral:** Adds ~$1-5/mo cost at scale (offset by Redis plan downgrade potential)

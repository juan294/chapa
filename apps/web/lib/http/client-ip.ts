/**
 * Extract client IP from request headers using Vercel's trusted proxy headers.
 *
 * Priority:
 * 1. x-vercel-forwarded-for — set by Vercel's edge network, cannot be spoofed by clients.
 * 2. x-forwarded-for (rightmost hop) — the rightmost entry is the last proxy in the chain,
 *    making it harder to spoof than the leftmost entry.
 *
 * x-real-ip is intentionally not used: it is a client-controlled header on Vercel
 * and cannot be trusted.
 *
 * Trusted proxy assumption: this module is designed for Vercel deployments where
 * x-vercel-forwarded-for is injected by Vercel's edge and cannot be spoofed by
 * clients. In local development or other hosting environments, neither header may
 * be present and the sentinel NO_TRUSTED_IP is returned instead.
 *
 * BE-M1 (#868): When no trusted IP header is present, callers MUST NOT collapse
 * all such requests into one shared rate-limit bucket. Instead, callers should check
 * `getClientIp(req) === NO_TRUSTED_IP` and apply a strict global cap or reject the
 * request outright. The sentinel is exported so callers can branch safely.
 */

/**
 * Sentinel returned by `getClientIp` when no trusted IP header is present.
 *
 * Callers that use the result as a rate-limit key MUST detect this sentinel
 * and apply a strict global cap rather than keying on a literal "unknown" string
 * (which would collapse all headerless requests into one shared bucket, defeating
 * per-IP rate limiting entirely).
 */
export const NO_TRUSTED_IP = "unknown" as const;

export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    const last = hops[hops.length - 1];
    if (last) {
      const trimmed = last.trim();
      if (trimmed) return trimmed;
    }
  }

  return NO_TRUSTED_IP;
}

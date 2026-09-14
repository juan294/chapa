/** Explicit qualification is never inferred from an ordinary localhost dev run. */
export function localCandidateTarget(environment: string | undefined, mode: string | undefined, target: string, bypassSecret?: string): boolean {
  if (environment !== "local" && mode !== "local-candidate") return false;
  if (environment !== "local" || mode !== "local-candidate") throw new Error("Local qualification requires environment=local and mode=local-candidate together");
  if (bypassSecret) throw new Error("Local qualification must not use a Vercel bypass secret");
  if (!/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?\/?$/.test(target)) throw new Error("Local candidate target must use an explicit loopback origin");
  let url: URL;
  try { url = new URL(target); } catch { throw new Error("Local candidate target must be a loopback origin"); }
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Local candidate target must be a loopback origin without credentials, path or query");
  return true;
}

/** Local process mode is distinct from a real deployed production identity. */
export function assertLocalCandidateRuntime(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing local runtime identity");
  const body = value as Record<string, unknown>;
  if (body.runtimeMode !== "production" || body.environment !== null || body.commitSha !== null) throw new Error("Local candidate needs production runtime with no invented deployment identity");
}

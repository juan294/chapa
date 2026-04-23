import { Redis } from "@upstash/redis";

const TTL_SECONDS = 600;
const KEY_PREFIX = "oauth-state:";
const REDIS_READ_RETRY_DELAYS_MS = [25, 75, 150] as const;

type FallbackEntry = {
  expiresAt: number;
};

export type OauthStateStoreMode = "shared" | "fallback";

let _redis: Redis | null | undefined;
const fallbackStateStore = new Map<string, FallbackEntry>();

function getKey(state: string): string {
  return `${KEY_PREFIX}${state}`;
}

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    _redis = null;
    return null;
  }

  _redis = new Redis({
    url,
    token,
    retry: { retries: 0, backoff: () => 0 },
    // OAuth state is written on /login and immediately consumed on /callback.
    // Without read-your-writes consistency, the callback can briefly miss the
    // fresh nonce and incorrectly reject a first-time login as a replay.
    readYourWrites: true,
  });
  return _redis;
}

function readFallbackState(state: string): boolean {
  const entry = fallbackStateStore.get(state);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    fallbackStateStore.delete(state);
    return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function issueOauthState(state: string): Promise<OauthStateStoreMode> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(getKey(state), "1", { ex: TTL_SECONDS });
      return "shared";
    } catch {
      // Fall back to local memory when Redis is unavailable.
    }
  }

  fallbackStateStore.set(state, {
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
  return "fallback";
}

export async function consumeOauthState(state: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const key = getKey(state);
      const existed = await (
        redis as unknown as { getdel<T>(key: string): Promise<T | null> }
      ).getdel<string>(key);
      if (existed === "1") return true;

      // Upstash read-your-writes consistency is client-scoped. In dev and
      // serverless environments, /login and /callback may hit distinct Redis
      // client instances, so the callback can briefly miss a freshly written
      // nonce. Retry the atomic consume a few times before treating it as a
      // replay.
      for (const delayMs of REDIS_READ_RETRY_DELAYS_MS) {
        await sleep(delayMs);
        const retried = await (
          redis as unknown as { getdel<T>(key: string): Promise<T | null> }
        ).getdel<string>(key);
        if (retried === "1") return true;
      }
      return false;
    } catch {
      // Fall back to local memory when Redis is unavailable.
    }
  }

  const existed = readFallbackState(state);
  fallbackStateStore.delete(state);
  return existed;
}

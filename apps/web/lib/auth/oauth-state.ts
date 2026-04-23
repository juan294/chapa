import { Redis } from "@upstash/redis";

const TTL_SECONDS = 600;
const KEY_PREFIX = "oauth-state:";

type FallbackEntry = {
  expiresAt: number;
};

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

  _redis = new Redis({ url, token, retry: { retries: 0, backoff: () => 0 } });
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

export async function issueOauthState(state: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(getKey(state), "1", { ex: TTL_SECONDS });
      return;
    } catch {
      // Fall back to local memory when Redis is unavailable.
    }
  }

  fallbackStateStore.set(state, {
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
}

export async function consumeOauthState(state: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      const existed = await (
        redis as unknown as { getdel<T>(key: string): Promise<T | null> }
      ).getdel<string>(getKey(state));
      return existed === "1";
    } catch {
      // Fall back to local memory when Redis is unavailable.
    }
  }

  const existed = readFallbackState(state);
  fallbackStateStore.delete(state);
  return existed;
}

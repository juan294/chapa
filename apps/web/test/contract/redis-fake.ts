import type {
  BadgeStats,
  CacheSetNxStatus,
  QuotaReservationResult,
  RateLimitResult,
} from "@/lib/cache/redis";

type StoredValue = {
  value: unknown;
  expiresAt?: number;
};

type CacheSetOptions = number | { ex?: number } | undefined;

const store = new Map<string, StoredValue>();
const hllStore = new Map<string, Set<string>>();

function now(): number {
  return Date.now();
}

function ttlFromOptions(options: CacheSetOptions): number {
  if (typeof options === "number") return options;
  return options?.ex ?? 21600;
}

function expiresAt(ttlSeconds: number): number | undefined {
  return ttlSeconds > 0 ? now() + ttlSeconds * 1000 : undefined;
}

function clone<T>(value: T): T {
  if (
    value === null ||
    typeof value === "undefined" ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function readRaw(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== undefined && entry.expiresAt <= now()) {
    store.delete(key);
    return null;
  }
  return clone(entry.value);
}

function writeRaw(key: string, value: unknown, ttlSeconds = 21600): void {
  store.set(key, { value: clone(value), expiresAt: expiresAt(ttlSeconds) });
}

function incrBy(key: string, amount: number, ttlSeconds?: number): number {
  const current = readRaw(key);
  const numeric = typeof current === "number" ? current : Number(current ?? 0);
  const next = (Number.isFinite(numeric) ? numeric : 0) + amount;
  const existing = store.get(key);
  store.set(key, {
    value: next,
    expiresAt:
      ttlSeconds !== undefined
        ? expiresAt(ttlSeconds)
        : existing?.expiresAt,
  });
  return next;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  return readRaw(key) as T | null;
}

async function cacheSet<T>(
  key: string,
  value: T,
  options?: CacheSetOptions,
): Promise<boolean> {
  writeRaw(key, value, ttlFromOptions(options));
  return true;
}

async function cacheDel(key: string): Promise<void> {
  store.delete(key);
  hllStore.delete(key);
}

async function cacheMGet<T>(keys: string[]): Promise<(T | null)[]> {
  return keys.map((key) => readRaw(key) as T | null);
}

async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const current = incrBy(key, 1);
  if (current === 1) {
    const entry = store.get(key);
    if (entry) entry.expiresAt = expiresAt(windowSeconds);
  }
  return { allowed: true, current, limit };
}

async function rateLimitStrict(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return rateLimit(key, limit, windowSeconds);
}

async function cacheReserveQuota(
  key: string,
  amount: number,
  limit: number,
  ttlSeconds: number,
): Promise<QuotaReservationResult> {
  if (amount <= 0) return { allowed: true, current: 0, limit };
  const beforeRaw = readRaw(key);
  const before = typeof beforeRaw === "number" ? beforeRaw : Number(beforeRaw ?? 0);
  const after = incrBy(key, amount, ttlSeconds);
  if (after > limit) {
    incrBy(key, -amount, ttlSeconds);
    return { allowed: false, current: before, limit };
  }
  return { allowed: true, current: after, limit };
}

async function trackBadgeGenerated(handle: string): Promise<void> {
  incrBy("stats:badges_generated", 1);
  const set = hllStore.get("stats:unique_badges") ?? new Set<string>();
  set.add(handle.toLowerCase());
  hllStore.set("stats:unique_badges", set);
}

async function getBadgeStats(): Promise<BadgeStats> {
  const total = readRaw("stats:badges_generated");
  return {
    total: typeof total === "number" ? total : 0,
    unique: hllStore.get("stats:unique_badges")?.size ?? 0,
  };
}

async function pingRedis(): Promise<"ok"> {
  return "ok";
}

async function cacheGetCronLastRun(name: string): Promise<number | null> {
  return cacheGet<number>(`cron:lastrun:${name}`);
}

async function cacheSetNxStatus(
  key: string,
  ttlSeconds: number,
): Promise<CacheSetNxStatus> {
  if (readRaw(key) !== null) return "exists";
  writeRaw(key, 1, ttlSeconds);
  return "acquired";
}

async function cacheSetNx(key: string, ttlSeconds: number): Promise<boolean> {
  return (await cacheSetNxStatus(key, ttlSeconds)) === "acquired";
}

async function cacheIncr(
  key: string,
  amount = 1,
  ttlSeconds?: number,
): Promise<number> {
  return incrBy(key, amount, ttlSeconds);
}

function _resetClient(): void {
  store.clear();
  hllStore.clear();
}

export const redisFake = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheMGet,
  rateLimit,
  rateLimitStrict,
  cacheReserveQuota,
  trackBadgeGenerated,
  getBadgeStats,
  pingRedis,
  cacheGetCronLastRun,
  cacheSetNxStatus,
  cacheSetNx,
  cacheIncr,
  _resetClient,
  __reset: _resetClient,
};

import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { qualificationRuntimeEnvironment, seedQualificationCache, QUALIFICATION_SESSION_SECRET, withQualificationServer, discardQualificationFetchCache } from "./local-scoring-qualification";
const local = { SUPABASE_URL: "http://127.0.0.1:55331", SUPABASE_SERVICE_ROLE_KEY: "local-service-key", UPSTASH_REDIS_REST_URL: "http://127.0.0.1:56380", UPSTASH_REDIS_REST_TOKEN: "local-redis-key", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" };
const task = { SUPABASE_URL: "http://127.0.0.1:55431", SUPABASE_SERVICE_ROLE_KEY: "local-service-key", UPSTASH_REDIS_REST_URL: "http://127.0.0.1:56480", UPSTASH_REDIS_REST_TOKEN: "local-redis-key", SCORING_DISPOSABLE_PROJECT: "chapa-volume-20260926" };
describe("disposable scoring qualification launcher", () => {
  it("constructs only local explicit runtime settings without inherited production routing", () => {
    const env = qualificationRuntimeEnvironment("/repo", "/repo/logs/qualification", { ...local, PATH: "/bin", VERCEL_ENV: "production", NEXTAUTH_SECRET: "external", DATABASE_URL: "remote", NODE_OPTIONS: "--require unwanted", GITHUB_TOKEN: "external" }, 3217);
    expect(env).toMatchObject({ NODE_ENV: "production", NEXTAUTH_SECRET: QUALIFICATION_SESSION_SECRET, SUPABASE_URL: local.SUPABASE_URL, UPSTASH_REDIS_REST_URL: local.UPSTASH_REDIS_REST_URL, GITHUB_TOKEN: "redesign-local-fixture", REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" });
    expect(env.VERCEL_ENV).toBeUndefined(); expect(env.DATABASE_URL).toBeUndefined(); expect(env.NODE_OPTIONS).toBeUndefined();
    expect(Object.values(env)).not.toContain("external");
  });
  it.each(["https://remote.example", "http://127.1:55331", "http://127.0.0.1:54331", "http://localhost@remote.test"])("rejects unacknowledged or different service target%s", SUPABASE_URL => {
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...local, SUPABASE_URL }, 3217)).toThrow(/target|loopback|disposable/);
  });
  it("requires an explicit disposable acknowledgment and local service credentials", () => {
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...local, REDESIGN_DISPOSABLE_PROJECT: "" }, 3217)).toThrow(/acknowledg/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...local, SUPABASE_SERVICE_ROLE_KEY: "" }, 3217)).toThrow(/credential/);
  });
  it("admits only the named task stack with its own acknowledgement and cache", () => {
    const env = qualificationRuntimeEnvironment("/repo", "/evidence", task, 3217);
    expect(env).toMatchObject({ SUPABASE_URL: task.SUPABASE_URL, UPSTASH_REDIS_REST_URL: task.UPSTASH_REDIS_REST_URL, SCORING_DISPOSABLE_PROJECT: task.SCORING_DISPOSABLE_PROJECT });
    expect(env.REDESIGN_DISPOSABLE_PROJECT).toBeUndefined();
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, REDESIGN_DISPOSABLE_PROJECT: "chapa-redesign" })).toThrow(/only/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, SCORING_DISPOSABLE_PROJECT: "other" })).toThrow(/acknowledg/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, SUPABASE_URL: local.SUPABASE_URL })).toThrow(/target/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, UPSTASH_REDIS_REST_URL: local.UPSTASH_REDIS_REST_URL })).toThrow(/target/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, SUPABASE_URL: "http://localhost:55431" })).toThrow(/target/);
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...task, UPSTASH_REDIS_REST_URL: "https://redis.example" })).toThrow(/target/);
  });
  it("seeds real Redis through guarded REST, checks every reply and cleans only inserted keys", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json([{ result: "OK" }, { result: null }])).mockResolvedValueOnce(Response.json({ result: 1 }));
    await expect(seedQualificationCache(local.UPSTASH_REDIS_REST_URL, "local-key", { "stats:v3:one": "first", "stats:v3:two": "second" }, fetch)).rejects.toThrow(/existing|seed/);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "error", method: "POST" });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(["del", "stats:v3:one"]);
  });
  it("rejects remote cache before any request", async () => {
    const fetch = vi.fn();
    await expect(seedQualificationCache("https://real.upstash.io", "key", { key: "value" }, fetch)).rejects.toThrow(/target/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("accepts only the matching task cache target", async () => {
    const send = vi.fn().mockResolvedValue(Response.json([{ result: "OK" }]));
    const cleanup = await seedQualificationCache(task.UPSTASH_REDIS_REST_URL, "key", { one: "value" }, send, task.UPSTASH_REDIS_REST_URL);
    expect(send).toHaveBeenCalledWith(`${task.UPSTASH_REDIS_REST_URL}/pipeline`, expect.any(Object));
    send.mockResolvedValueOnce(Response.json({ result: 1 }));
    await cleanup();
    expect(() => qualificationRuntimeEnvironment("/repo", "/evidence", { ...local, UPSTASH_REDIS_REST_URL: task.UPSTASH_REDIS_REST_URL })).toThrow(/target/);
  });
});

it("stops and awaits the owned server when writing launch evidence fails", async () => {
  const order: string[] = [];
  let finish!: (code: number) => void;
  const exited = new Promise<number>(resolve => { finish = resolve; });
  await expect(withQualificationServer({ kill: () => { order.push("stop"); finish(0); return true; } }, exited, async () => { throw new Error("evidence write failed"); })).rejects.toThrow("evidence write failed");
  order.push("cleanup");
  expect(order).toEqual(["stop", "cleanup"]);
});
it("reports uncertain Redis writes explicitly when the pipeline response is lost", async () => {
  const send = vi.fn().mockRejectedValue(new Error("transport"));
  await expect(seedQualificationCache(local.UPSTASH_REDIS_REST_URL, "local-key", { one: "value" }, send)).rejects.toThrow(/uncertain.*retain.*disposable/i);
});

it("uses synthetic OAuth settings and admits only the named redesign admin fixtures", () => {
  const env = qualificationRuntimeEnvironment("/repo", "/evidence", { ...local, GITHUB_CLIENT_ID: "external-id", GITHUB_CLIENT_SECRET: "external-secret", ADMIN_HANDLES: "real-owner" });
  expect(env.GITHUB_CLIENT_ID).toBe("local-scoring-qualification-client");
  expect(env.GITHUB_CLIENT_SECRET).toBe("local-scoring-qualification-client-secret");
  expect(env.ADMIN_HANDLES?.split(",").sort()).toEqual(["en", "es"].flatMap(locale => ["light", "dark"].flatMap(theme => ["desktop", "mobile"].map(device => `chapa-redesign-${locale}-${theme}-${device}`))).sort());
  expect(Object.values(env)).not.toContain("external-id");
  expect(env.ADMIN_HANDLES).not.toContain("real-owner");
});

it("discards only build-time fetch cache while preserving compiled and other cache artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "chapa-qualification-cache-"));
  try {
    const next = join(root, "apps/web/.next");
    mkdirSync(join(next, "cache/fetch-cache"), { recursive: true });
    writeFileSync(join(next, "cache/fetch-cache/negative-flag"), "null");
    writeFileSync(join(next, "cache/keep"), "other cache");
    writeFileSync(join(next, "BUILD_ID"), "compiled build");
    discardQualificationFetchCache(root);
    expect(existsSync(join(next, "cache/fetch-cache"))).toBe(false);
    expect(existsSync(join(next, "cache/keep"))).toBe(true);
    expect(existsSync(join(next, "BUILD_ID"))).toBe(true);
    expect(() => discardQualificationFetchCache(root)).not.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
it.each(["cache", "cache/fetch-cache"])("rejects symlink at %s without touching its target", relative => {
  const root = mkdtempSync(join(tmpdir(), "chapa-qualification-cache-"));
  try {
    const next = join(root, "apps/web/.next"), target = join(root, "separate");
    mkdirSync(target); writeFileSync(join(target, "keep"), "untouched");
    mkdirSync(join(next, relative === "cache" ? "" : "cache"), { recursive: true });
    symlinkSync(target, join(next, relative));
    expect(() => discardQualificationFetchCache(root)).toThrow(/symlink/);
    expect(existsSync(join(target, "keep"))).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

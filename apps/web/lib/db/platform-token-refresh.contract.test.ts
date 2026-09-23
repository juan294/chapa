import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget, inspectLocalSql } from "@/test/contract/local-sql";
import { encryptToken } from "@/lib/auth/github";
import { getNextauthSecret } from "@/lib/env";
import { dbGetLinkedPlatformStrict, dbUpsertLinkedPlatform, type StrictLinkedPlatform } from "./user-platforms";
import { databaseInstantMicros } from "./source-time";
import { readSourceAuthorization } from "../platform/source-authorization";

// Keep real DB claim/finish, real token encryption and real provider HTTP code.
// The feature/authorization presentation seam is controlled; the RPC
// independently enforces exact linkage on every mutation. Publication consent
// is retired (#1335 phase 2) — claim/finish/takeover no longer read
// `scoring_v7_subjects` at all, so a refresh works the same whether or not
// the owner has a registered subject row.
vi.mock("../platform/source-authorization", async original => ({
  ...await original<typeof import("../platform/source-authorization")>(), readSourceAuthorization: vi.fn(),
}));
vi.mock("@/lib/env", async original => ({ ...await original<typeof import("@/lib/env")>(),
  getGitlabClientId: () => "fixture-client", getGitlabClientSecret: () => "fixture-secret",
}));
const owner = "contract-refresh-barrier";
const consent = "2026-09-05T12:00:00.000Z";
let link: StrictLinkedPlatform;
async function currentLink() {
  const result = await dbGetLinkedPlatformStrict(owner, "gitlab");
  if (result.status !== "linked") throw new Error("Expected fixture connection");
  return result.link;
}
async function cleanup() {
  assertLocalSqlTarget();
  expect((await getServiceClient().from("user_platforms").delete().eq("handle", owner)).error).toBeNull();
  expect((await getServiceClient().from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
}
beforeEach(async () => {
  await cleanup();
  const db = getServiceClient(); const secret = getNextauthSecret()!;
  expect((await db.rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
  expect((await db.from("user_platforms").insert({ id: randomUUID(), handle: owner, platform: "gitlab", remote_login: "remote-fixture",
    access_token: encryptToken("old-access", secret), refresh_token: encryptToken("same-refresh", secret), token_expires_at: "2020-01-01T00:00:00Z" })).error).toBeNull();
  link = await currentLink();
  vi.mocked(readSourceAuthorization).mockImplementation(async () => ({ status: "authorized", subjectVersion: consent, link: await currentLink() }));
});
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); await cleanup(); });
function claimArgs(current = link, attempt = randomUUID()) {
  return { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_link_id: current.id, p_link_version: current.updatedAt, p_attempt_id: attempt };
}
function finishArgs(claim: ReturnType<typeof claimArgs>) {
  const secret = getNextauthSecret()!;
  return { ...claim, p_access_token: encryptToken("new-access", secret), p_refresh_token: encryptToken("same-refresh", secret), p_expires_at: "2099-01-01T00:00:00Z" };
}
async function attempts(id = link.id) {
  const result = await getServiceClient().from("platform_token_refresh_attempts").select("*").eq("link_id", id);
  expect(result.error).toBeNull(); return result.data!;
}
describe("durable refresh barrier (requires reviewed migrations046/048)", () => {
  it("denies browser roles table access and claim/finish/release/takeover execution", () => {
    const query = "SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('platform_token_refresh_claim','platform_token_refresh_finish','platform_token_refresh_release','platform_token_refresh_release_attempt','platform_token_refresh_takeover') ORDER BY p.proname; SELECT 'table',has_table_privilege('anon','public.platform_token_refresh_attempts','SELECT'),has_table_privilege('authenticated','public.platform_token_refresh_attempts','SELECT'),has_table_privilege('service_role','public.platform_token_refresh_attempts','SELECT'); SELECT 'mutation',has_table_privilege('service_role','public.platform_token_refresh_attempts','INSERT'),has_table_privilege('service_role','public.platform_token_refresh_attempts','UPDATE'),has_table_privilege('service_role','public.platform_token_refresh_attempts','DELETE')";
    expect(inspectLocalSql(query).split("\n")).toEqual([
      "platform_token_refresh_claim|f|f|t",
      "platform_token_refresh_finish|f|f|t",
      "platform_token_refresh_release|f|f|t",
      "platform_token_refresh_release_attempt|f|f|t",
      "platform_token_refresh_takeover|f|f|t",
      "table|f|f|t",
      "mutation|f|f|f",
    ]);
  });

  it("allows one provider HTTP request across two independent module instances, preserving paused success", async () => {
    const firstWorker = (await import("../platform/source-refresh")).refreshSourceLink;
    vi.resetModules();
    const secondWorker = (await import("../platform/source-refresh")).refreshSourceLink;
    expect(firstWorker).not.toBe(secondWorker);
    let announce!: () => void; let release!: () => void;
    const started = new Promise<void>(resolve => { announce = resolve; });
    const finish = new Promise<void>(resolve => { release = resolve; });
    const nativeFetch = globalThis.fetch.bind(globalThis); let providerCalls = 0;
    vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
      providerCalls++; announce(); await finish;
      return new Response(JSON.stringify({ access_token: "new-access", refresh_token: "same-refresh", token_type: "bearer", expires_in: 3600 }), { status: 200 });
    });
    const initial = { status: "authorized" as const, subjectVersion: consent, link };
    const input = { owner, provider: "gitlab" as const };
    const first = firstWorker(initial, input);
    try {
      await Promise.race([started, first.then(() => { throw new Error("First worker stopped before provider request"); })]);
      expect(await secondWorker(initial, input)).toEqual({ status: "unavailable" });
      expect(providerCalls).toBe(1); expect(await attempts()).toHaveLength(1);
      expect((await currentLink()).tokens.accessToken).toBe("old-access");
    } finally { release(); }
    expect((await first).status).toBe("authorized");
    const stored = await currentLink();
    expect(stored.tokens.accessToken).toBe("new-access"); expect(stored.tokens.refreshToken).toBe("same-refresh");
    expect(databaseInstantMicros(stored.updatedAt)).toBeGreaterThan(databaseInstantMicros(link.updatedAt));
    expect(await attempts()).toEqual([]);
  });

  it("retains an ambiguous provider attempt across time and never automatically replays it", async () => {
    const worker = (await import("../platform/source-refresh")).refreshSourceLink;
    const nativeFetch = globalThis.fetch.bind(globalThis); let calls = 0;
    vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
      calls++; throw new Error("Response lost after possible provider execution");
    });
    const initial = { status: "authorized" as const, subjectVersion: consent, link };
    expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime("2099-09-05T12:00:00Z");
    expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
    expect(calls).toBe(1); expect(await attempts()).toHaveLength(1);
    expect((await currentLink()).tokens.accessToken).toBe("old-access");
  });

  it("keeps the barrier through ordinary version changes and withdrawal/reconsent", async () => {
    const db = getServiceClient(); const original = claimArgs();
    expect((await db.rpc("platform_token_refresh_claim", original)).data.status).toBe("claimed");
    expect((await db.rpc("platform_token_refresh_claim", original)).data).toEqual({ status: "busy" });
    expect((await db.from("user_platforms").update({ remote_login: "metadata-only-change" }).eq("id", link.id)).error).toBeNull();
    const changed = await currentLink();
    expect((await db.rpc("platform_token_refresh_claim", claimArgs(changed))).data).toEqual({ status: "busy" });
    expect((await db.rpc("platform_token_refresh_finish", finishArgs(original))).data).toEqual({ status: "stale" });
    expect((await db.rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true })).error).toBeNull();
    expect(await attempts()).toHaveLength(1);
    expect((await db.from("scoring_v7_subjects").select("owner_handle").eq("owner_handle", owner)).data).toEqual([]);
    const withdrawnClaim = await db.rpc("platform_token_refresh_claim", claimArgs(changed));
    expect(withdrawnClaim.error).toBeNull();
    expect(withdrawnClaim.data).toEqual({ status: "busy" });
    expect((await db.rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
    expect((await db.rpc("platform_token_refresh_claim", claimArgs(changed))).data).toEqual({ status: "busy" });
    expect(Object.keys((await attempts())[0]).sort()).toEqual(["attempt_id", "link_id", "link_version", "started_at", "takeover_used"]);
  });

  it("renews an absent-subject legacy connection through one real provider adapter request", async () => {
    const db = getServiceClient();
    expect((await db.from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
    vi.mocked(readSourceAuthorization).mockImplementation(async () => ({ status: "authorized", subjectVersion: "legacy-unpublished", link: await currentLink() }));
    const nativeFetch = globalThis.fetch.bind(globalThis); let calls = 0;
    vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
      calls++;
      return new Response(JSON.stringify({ access_token: "new-access", refresh_token: "same-refresh", token_type: "bearer", expires_in: 3600 }), { status: 200 });
    });
    const worker = (await import("../platform/source-refresh")).refreshSourceLink;
    const renewed = await worker({ status: "authorized", subjectVersion: "legacy-unpublished", link }, { owner, provider: "gitlab" }, false);
    expect(renewed.status).toBe("authorized");
    expect((await currentLink()).tokens.accessToken).toBe("new-access");
    expect(await attempts()).toEqual([]);
    expect((await db.from("scoring_v7_subjects").select("owner_handle").eq("owner_handle", owner)).data).toEqual([]);
    if (renewed.status !== "authorized") throw new Error("Expected legacy renewal");
    expect(await worker(renewed, { owner, provider: "gitlab" }, false)).toEqual(renewed);
    expect(calls).toBe(1);
  });

  it("does not repeat an ambiguous provider refresh after withdrawal or reconsent", async () => {
    const db = getServiceClient();
    const worker = (await import("../platform/source-refresh")).refreshSourceLink;
    const nativeFetch = globalThis.fetch.bind(globalThis); let calls = 0;
    vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
      calls++; throw new Error("Response lost after possible provider execution");
    });
    expect(await worker({ status: "authorized", subjectVersion: consent, link }, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
    const barrier = await attempts();
    expect(barrier).toHaveLength(1);
    expect((await db.rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true })).error).toBeNull();
    vi.mocked(readSourceAuthorization).mockImplementation(async () => ({ status: "authorized", subjectVersion: "legacy-unpublished", link: await currentLink() }));
    expect(await worker({ status: "authorized", subjectVersion: "legacy-unpublished", link }, { owner, provider: "gitlab" }, false)).toEqual({ status: "unavailable" });
    const reconsent = "2026-09-06T12:00:00Z";
    expect((await db.rpc("scoring_v7_ensure_subject", { p_owner: owner })).error).toBeNull();
    vi.mocked(readSourceAuthorization).mockImplementation(async () => ({ status: "authorized", subjectVersion: reconsent, link: await currentLink() }));
    expect(await worker({ status: "authorized", subjectVersion: reconsent, link }, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
    expect(await attempts()).toEqual(barrier);
    expect((await currentLink()).tokens.accessToken).toBe("old-access");
    expect(calls).toBe(1);
  });

  it("cascades an explicit disconnect/account parent deletion and fences the replacement", async () => {
    const db = getServiceClient(); const original = claimArgs();
    expect((await db.rpc("platform_token_refresh_claim", original)).data.status).toBe("claimed");
    // The administrative deletion inventory deletes this exact parent by handle.
    expect((await db.from("user_platforms").delete().eq("handle", owner)).error).toBeNull();
    expect(await attempts()).toEqual([]);
    const replacement = randomUUID();
    expect((await db.from("user_platforms").insert({ id: replacement, handle: owner, platform: "gitlab", remote_login: "replacement", access_token: "replacement-ciphertext", updated_at: link.updatedAt })).error).toBeNull();
    expect((await db.rpc("platform_token_refresh_finish", finishArgs(original))).data).toEqual({ status: "stale" });
    expect((await db.from("user_platforms").select("access_token").eq("id", replacement).single()).data!.access_token).toBe("replacement-ciphertext");
  });

  // Without this the documented disconnect/reconnect recovery does not exist:
  // a reconnect upserts the same row, so the new grant inherits the barrier.
  it("clears a superseded attempt when a reconnect replaces the grant in place", async () => {
    const db = getServiceClient();
    expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
    expect(await attempts()).toHaveLength(1);

    expect(await dbUpsertLinkedPlatform(owner, "gitlab", "remote-fixture", "reconnected-access", "reconnected-refresh", null)).toBe(true);

    const reconnected = await currentLink();
    expect(reconnected.id).toBe(link.id);
    expect(databaseInstantMicros(reconnected.updatedAt)).toBeGreaterThan(databaseInstantMicros(link.updatedAt));
    expect(await attempts()).toEqual([]);
    expect((await db.rpc("platform_token_refresh_claim", claimArgs(reconnected))).data.status).toBe("claimed");
  });

  it("preserves an attempt claimed against the version the release is given", async () => {
    const db = getServiceClient();
    expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
    const release = { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt };
    expect((await db.rpc("platform_token_refresh_release", release)).data).toEqual({ status: "released", cleared: 0 });
    expect(await attempts()).toHaveLength(1);

    expect((await db.from("user_platforms").update({ remote_login: "metadata-only-change" }).eq("id", link.id)).error).toBeNull();
    const changed = await currentLink();
    expect((await db.rpc("platform_token_refresh_release", { ...release, p_link_version: changed.updatedAt })).data).toEqual({ status: "released", cleared: 1 });
    expect(await attempts()).toEqual([]);
  });

  it("refuses a release without matching authority or the current link version", async () => {
    const db = getServiceClient();
    expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
    const release = { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_link_id: link.id, p_link_version: link.updatedAt };
    for (const changes of [{ p_actor: "other" }, { p_owner: null }, { p_platform: "github" }, { p_link_version: "infinity" }]) {
      expect((await db.rpc("platform_token_refresh_release", { ...release, ...changes })).error).not.toBeNull();
    }
    for (const changes of [{ p_link_id: randomUUID() }, { p_link_version: "2020-01-01T00:00:00Z" }]) {
      expect((await db.rpc("platform_token_refresh_release", { ...release, ...changes })).data).toEqual({ status: "stale" });
    }
    expect(await attempts()).toHaveLength(1);
  });

  it("rejects NULL/mismatched authority and stale UUID/version without storing a claim", async () => {
    const db = getServiceClient();
    for (const changes of [{ p_actor: null }, { p_owner: null }, { p_actor: "other" }, { p_platform: null }, { p_link_version: "infinity" }, { p_attempt_id: null }]) {
      expect((await db.rpc("platform_token_refresh_claim", { ...claimArgs(), ...changes })).error).not.toBeNull();
    }
    for (const changes of [{ p_link_id: randomUUID() }, { p_link_version: "2020-01-01T00:00:00Z" }]) {
      expect((await db.rpc("platform_token_refresh_claim", { ...claimArgs(), ...changes })).data).toEqual({ status: "stale" });
    }
    expect(await attempts()).toEqual([]);
  });

  it("keeps tokens and barrier unchanged on bad completion, then commits a valid completion atomically", async () => {
    const db = getServiceClient(); const args = claimArgs();
    expect((await db.rpc("platform_token_refresh_claim", args)).data.status).toBe("claimed");
    const old = (await db.from("user_platforms").select("access_token,refresh_token,updated_at").eq("id", link.id).single()).data;
    for (const change of [{ p_actor: null }, { p_access_token: "" }, { p_attempt_id: randomUUID() }, { p_link_version: "2020-01-01T00:00:00Z" }]) {
      const reply = await db.rpc("platform_token_refresh_finish", { ...finishArgs(args), ...change });
      expect(Boolean(reply.error) || reply.data?.status === "stale").toBe(true);
      expect((await db.from("user_platforms").select("access_token,refresh_token,updated_at").eq("id", link.id).single()).data).toEqual(old);
      expect(await attempts()).toHaveLength(1);
    }
    const result = await db.rpc("platform_token_refresh_finish", finishArgs(args));
    expect(result.error).toBeNull(); expect(result.data.status).toBe("updated");
    expect((await currentLink()).tokens).toMatchObject({ accessToken: "new-access", refreshToken: "same-refresh" });
    expect(await attempts()).toEqual([]);
    expect((await db.rpc("platform_token_refresh_finish", finishArgs(args))).data).toEqual({ status: "stale" });
    expect((await db.rpc("platform_token_refresh_claim", claimArgs(await currentLink()))).data.status).toBe("claimed");
  });
});

// #1332 / migration 053 — release a non-ambiguous attempt in the same call,
// and allow exactly one bounded takeover of a genuinely stale ambiguous one.
describe("claim recovery: release_attempt & takeover (#1332, migration 053)", () => {
  function releaseAttemptArgs(needsReconnect: boolean, current = link, attempt = randomUUID()) {
    return { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_link_id: current.id,
      p_link_version: current.updatedAt, p_attempt_id: attempt, p_needs_reconnect: needsReconnect };
  }
  function takeoverArgs(maxAgeSeconds: number, current = link, newAttempt = randomUUID()) {
    return { p_owner: owner, p_actor: owner, p_platform: "gitlab", p_link_id: current.id,
      p_link_version: current.updatedAt, p_new_attempt_id: newAttempt, p_max_age_seconds: maxAgeSeconds };
  }
  async function needsReconnectFlag(id = link.id) {
    const result = await getServiceClient().from("user_platforms").select("needs_reconnect").eq("id", id).single();
    expect(result.error).toBeNull(); return result.data!.needs_reconnect;
  }
  /** Backdates the durable attempt's `started_at` using the DB's own clock
   * via a direct `psql` connection (the service role has no table-level
   * UPDATE grant — all mutation goes through the SECURITY DEFINER RPCs), so
   * the takeover RPC's staleness check (which also reads the DB clock) sees
   * a genuinely old attempt without depending on wall-clock sleeps or JS
   * `Date` mocking (irrelevant to Postgres `clock_timestamp()`). */
  async function backdateAttempt(seconds: number, id = link.id) {
    assertLocalSqlTarget();
    inspectLocalSql(`UPDATE public.platform_token_refresh_attempts SET started_at = now() - interval '${seconds} seconds' WHERE link_id = '${id}'`);
  }

  describe("platform_token_refresh_release_attempt", () => {
    it("releases a matching attempt without marking needs_reconnect by default", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      const result = await db.rpc("platform_token_refresh_release_attempt", releaseAttemptArgs(false, link, attemptId));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "released", needsReconnect: false });
      expect(await attempts()).toEqual([]);
      expect(await needsReconnectFlag()).toBe(false);
    });

    it("releases a matching attempt AND marks needs_reconnect in the same call", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      const result = await db.rpc("platform_token_refresh_release_attempt", releaseAttemptArgs(true, link, attemptId));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "released", needsReconnect: true });
      expect(await attempts()).toEqual([]);
      expect(await needsReconnectFlag()).toBe(true);
    });

    it("requires no registered subject — recovery from a known outcome stays available to a withdrawn or legacy subject", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      expect((await db.from("scoring_v7_subjects").delete().eq("owner_handle", owner)).error).toBeNull();
      const result = await db.rpc("platform_token_refresh_release_attempt", releaseAttemptArgs(true, link, attemptId));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "released", needsReconnect: true });
      expect(await needsReconnectFlag()).toBe(true);
    });

    it("is stale when the link version no longer matches", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      const result = await db.rpc("platform_token_refresh_release_attempt", { ...releaseAttemptArgs(false, link, attemptId), p_link_version: "2020-01-01T00:00:00Z" });
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "stale" });
      expect(await attempts()).toHaveLength(1);
    });

    it("is stale when the attempt id no longer matches (already released, finished, or superseded)", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      const result = await db.rpc("platform_token_refresh_release_attempt", releaseAttemptArgs(false, link, randomUUID()));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "stale" });
      expect(await attempts()).toHaveLength(1);
    });

    it("rejects invalid arguments without mutating anything", async () => {
      const db = getServiceClient(); const attemptId = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, attemptId))).data.status).toBe("claimed");
      for (const changes of [{ p_actor: "other" }, { p_owner: null }, { p_platform: "github" }, { p_needs_reconnect: null }]) {
        expect((await db.rpc("platform_token_refresh_release_attempt", { ...releaseAttemptArgs(false, link, attemptId), ...changes })).error).not.toBeNull();
      }
      expect(await attempts()).toHaveLength(1);
      expect(await needsReconnectFlag()).toBe(false);
    });
  });

  describe("platform_token_refresh_takeover", () => {
    it("declines a fresh attempt (never deletes a fresher claim)", async () => {
      expect((await getServiceClient().rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
      const result = await getServiceClient().rpc("platform_token_refresh_takeover", takeoverArgs(3600));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "too_fresh" });
      expect(await attempts()).toHaveLength(1);
    });

    it("takes over a genuinely stale attempt exactly once, preserving the row's identity", async () => {
      const db = getServiceClient(); const original = randomUUID();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs(link, original))).data.status).toBe("claimed");
      await backdateAttempt(400);
      const newAttempt = randomUUID();
      const result = await db.rpc("platform_token_refresh_takeover", takeoverArgs(360, link, newAttempt));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "claimed", attemptId: newAttempt });
      const rows = await attempts();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ link_id: link.id, attempt_id: newAttempt, takeover_used: true });
    });

    it("never allows a second takeover of an already-taken-over row (exhausted)", async () => {
      const db = getServiceClient();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
      await backdateAttempt(400);
      expect((await db.rpc("platform_token_refresh_takeover", takeoverArgs(360))).data.status).toBe("claimed");
      // Even though the taken-over row is ALSO old enough by the same
      // threshold, takeover_used permanently forbids retaking it.
      await backdateAttempt(400);
      const result = await db.rpc("platform_token_refresh_takeover", takeoverArgs(360));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "exhausted" });
      expect(await attempts()).toHaveLength(1);
    });

    it("reports gone when no attempt is currently claimed", async () => {
      const result = await getServiceClient().rpc("platform_token_refresh_takeover", takeoverArgs(1));
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "gone" });
    });

    it("is stale when the link version no longer matches", async () => {
      const db = getServiceClient();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
      const result = await db.rpc("platform_token_refresh_takeover", { ...takeoverArgs(1), p_link_version: "2020-01-01T00:00:00Z" });
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ status: "stale" });
    });

    it("rejects invalid arguments without mutating anything", async () => {
      const db = getServiceClient();
      expect((await db.rpc("platform_token_refresh_claim", claimArgs())).data.status).toBe("claimed");
      for (const changes of [{ p_actor: "other" }, { p_owner: null }, { p_new_attempt_id: null }, { p_max_age_seconds: 0 }, { p_max_age_seconds: -1 }]) {
        expect((await db.rpc("platform_token_refresh_takeover", { ...takeoverArgs(360), ...changes })).error).not.toBeNull();
      }
      expect(await attempts()).toHaveLength(1);
    });
  });

  describe("refreshSourceLink end-to-end through a real stale ambiguous claim", () => {
    it("takes over and completes successfully after the threshold has passed", async () => {
      const nativeFetch = globalThis.fetch.bind(globalThis); let calls = 0;
      vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
        calls++;
        if (calls === 1) throw new Error("Response lost after possible provider execution");
        return new Response(JSON.stringify({ access_token: "post-takeover-access", refresh_token: "same-refresh", token_type: "bearer", expires_in: 3600 }), { status: 200 });
      });
      const initial = { status: "authorized" as const, subjectVersion: consent, link };
      const worker = (await import("../platform/source-refresh")).refreshSourceLink;
      expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
      expect(await attempts()).toHaveLength(1);
      await backdateAttempt(400);
      const result = await worker(initial, { owner, provider: "gitlab" });
      expect(result.status).toBe("authorized");
      const stored = await currentLink();
      expect(stored.tokens.accessToken).toBe("post-takeover-access");
      expect(await attempts()).toEqual([]);
      expect(calls).toBe(2);
    });

    it("marks needs_reconnect without releasing the barrier when the takeover retry is itself ambiguous", async () => {
      const nativeFetch = globalThis.fetch.bind(globalThis); let calls = 0;
      vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
        calls++; throw new Error("Response lost after possible provider execution");
      });
      const initial = { status: "authorized" as const, subjectVersion: consent, link };
      const worker = (await import("../platform/source-refresh")).refreshSourceLink;
      expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
      await backdateAttempt(400);
      expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
      expect(calls).toBe(2);
      // The barrier is still there (genuinely unknown outcome) but exhausted.
      const rows = await attempts();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.takeover_used).toBe(true);
      expect(await needsReconnectFlag()).toBe(true);
      expect((await currentLink()).tokens.accessToken).toBe("old-access");
    });

    it("releases the barrier and marks needs_reconnect on a real definitive revoke", async () => {
      const nativeFetch = globalThis.fetch.bind(globalThis);
      vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (String(url) !== "https://gitlab.com/oauth/token") return nativeFetch(url, init);
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      });
      const initial = { status: "authorized" as const, subjectVersion: consent, link };
      const worker = (await import("../platform/source-refresh")).refreshSourceLink;
      expect(await worker(initial, { owner, provider: "gitlab" })).toEqual({ status: "unavailable" });
      expect(await attempts()).toEqual([]);
      expect(await needsReconnectFlag()).toBe(true);
      expect((await currentLink()).tokens.accessToken).toBe("old-access");
      // The barrier being released means an ordinary next claim proceeds normally.
      expect((await getServiceClient().rpc("platform_token_refresh_claim", claimArgs(await currentLink()))).data.status).toBe("claimed");
    });
  });
});

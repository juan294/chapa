import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabase } from "@/lib/db/supabase";
import { dbGetLinkedPlatformStrict } from "@/lib/db/user-platforms";
import { readSourceAuthorization, sameSourceAuthorization } from "./source-authorization";
vi.mock("@/lib/db/supabase", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/db/user-platforms", () => ({ dbGetLinkedPlatformStrict: vi.fn() }));
const link = { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "linked-alice",
  tokens: { accessToken: "private-token", refreshToken: null, expiresAt: null } };
let rows: Record<string, { data: unknown; error: unknown }>;
const filters: { table: string; column: string; value: unknown }[] = [];
const from = vi.fn((table: string) => ({ select: vi.fn(() => ({ eq: vi.fn((column: string, value: unknown) => {
  filters.push({ table, column, value }); return { maybeSingle: vi.fn(async () => rows[table]) };
}) })) }));
beforeEach(() => {
  vi.clearAllMocks(); filters.length = 0;
  rows = { scoring_v7_subjects: { data: { created_at: "2026-09-05T12:00:00.000001Z" }, error: null },
    feature_flags: { data: { enabled: true }, error: null } };
  vi.mocked(getSupabase).mockReturnValue({ from } as unknown as NonNullable<ReturnType<typeof getSupabase>>);
  vi.mocked(dbGetLinkedPlatformStrict).mockResolvedValue({ status: "linked", link });
});
describe("production current source authorization reads", () => {
  it("reads subject registration and the current database flag before selecting the exact owner's link", async () => {
    const result = await readSourceAuthorization("alice", "gitlab");
    expect(result).toEqual({ status: "authorized", consentVersion: "2026-09-05T12:00:00.000001Z", link });
    expect(filters).toEqual([{ table: "scoring_v7_subjects", column: "owner_handle", value: "alice" }, { table: "feature_flags", column: "key", value: "gitlab_integration" }]);
    expect(dbGetLinkedPlatformStrict).toHaveBeenCalledWith("alice", "gitlab");
  });
  it.each([null, { created_at: null }])("rejects an unregistered subject without reading linked credentials", async data => {
    rows.scoring_v7_subjects = { data, error: null };
    expect(await readSourceAuthorization("alice", "gitlab")).toEqual({ status: "unavailable" });
    expect(from).toHaveBeenCalledTimes(1); expect(dbGetLinkedPlatformStrict).not.toHaveBeenCalled();
  });
  it("fails closed on subject storage failure", async () => {
    rows.scoring_v7_subjects = { data: null, error: { message: "private storage error" } };
    expect(await readSourceAuthorization("alice", "github")).toEqual({ status: "unavailable" });
  });
  it("treats a missing or failed flag as unavailable and a current false flag as disabled", async () => {
    for (const record of [{ data: null, error: null }, { data: null, error: { message: "private" } }, { data: { enabled: "true" }, error: null }]) {
      rows.feature_flags = record; expect(await readSourceAuthorization("alice", "gitlab")).toEqual({ status: "unavailable" });
    }
    rows.feature_flags = { data: { enabled: false }, error: null };
    expect(await readSourceAuthorization("alice", "gitlab")).toEqual({ status: "disabled" });
    expect(dbGetLinkedPlatformStrict).not.toHaveBeenCalled();
  });
  it("distinguishes no link from failed storage/decryption", async () => {
    vi.mocked(dbGetLinkedPlatformStrict).mockResolvedValue({ status: "unlinked" });
    expect(await readSourceAuthorization("alice", "gitlab")).toEqual({ status: "unlinked" });
    for (const reasonCode of ["storage_error", "invalid_record", "credential_error"] as const) {
      vi.mocked(dbGetLinkedPlatformStrict).mockResolvedValue({ status: "unavailable", reasonCode });
      expect(await readSourceAuthorization("alice", "gitlab")).toEqual({ status: "unavailable" });
    }
  });
  it("authorizes GitHub only for a registered subject, without inventing a linked provider row", async () => {
    expect(await readSourceAuthorization("alice", "github")).toEqual({ status: "authorized", consentVersion: "2026-09-05T12:00:00.000001Z", link: null });
    expect(from).toHaveBeenCalledTimes(1); expect(dbGetLinkedPlatformStrict).not.toHaveBeenCalled();
  });
  it("keeps the explicitly legacy path separate without creating a v7 subject row", async () => {
    expect(await readSourceAuthorization("alice", "gitlab", false)).toEqual({ status: "authorized", consentVersion: "legacy-unpublished", link });
    expect(from.mock.calls).toEqual([["feature_flags"]]);
  });
  it("observes flag changes on the next call rather than retaining an authorization cache", async () => {
    expect((await readSourceAuthorization("alice", "gitlab")).status).toBe("authorized");
    rows.feature_flags = { data: { enabled: false }, error: null };
    expect((await readSourceAuthorization("alice", "gitlab")).status).toBe("disabled");
  });
  it("compares the full microsecond link version and consent revision", () => {
    const initial = { status: "authorized" as const, consentVersion: "consent1", link };
    expect(sameSourceAuthorization(initial, structuredClone(initial))).toBe(true);
    expect(sameSourceAuthorization(initial, { ...initial, consentVersion: "consent2" })).toBe(false);
    expect(sameSourceAuthorization(initial, { ...initial, link: { ...link, updatedAt: "2026-09-05T12:00:00.000002Z" } })).toBe(false);
    expect(sameSourceAuthorization(initial, { ...initial, link: { ...link, tokens: { ...link.tokens, accessToken: "rotated" } } })).toBe(false);
  });
});

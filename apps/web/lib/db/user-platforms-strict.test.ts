import { beforeEach, describe, expect, it, vi } from "vitest";
import { dbGetLinkedPlatformStrict } from "./user-platforms";
import { getSupabase } from "./supabase";
vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/env", () => ({ getNextauthSecret: () => "secret" }));
vi.mock("@/lib/auth/github", () => ({ decryptToken: (s: string) => s.startsWith("enc:") ? s.slice(4) : null, encryptToken: vi.fn() }));
const row = { id: "11111111-1111-4111-8111-111111111111", handle: "alice", platform: "gitlab", remote_login: "alice-lab", updated_at: "2026-09-05T12:00:00.123456+00:00", access_token: "enc:access", refresh_token: "enc:refresh", token_expires_at: null };
function setup(data: unknown, error: unknown = null) {
 const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data, error }) };
 vi.mocked(getSupabase).mockReturnValue({ from: () => query } as never);
 return query;
}
beforeEach(() => vi.clearAllMocks());
describe("strict current linked lookup", () => {
 it("distinguishes unlinked from unavailable without writes or leaked errors", async () => {
  vi.mocked(getSupabase).mockReturnValue(null);
  expect(await dbGetLinkedPlatformStrict("alice", "gitlab")).toEqual({ status: "unavailable", reasonCode: "storage_error" });
  setup(null); expect(await dbGetLinkedPlatformStrict("alice", "gitlab")).toEqual({ status: "unlinked" });
  setup(null, { message: "private-token" });
  expect(await dbGetLinkedPlatformStrict("alice", "gitlab")).toEqual({ status: "unavailable", reasonCode: "storage_error" });
 });
 it("returns current identity/version and decrypted credentials", async () => {
  const q = setup(row);
  expect(await dbGetLinkedPlatformStrict("ALICE", "gitlab")).toMatchObject({ status: "linked", link: { id: row.id, updatedAt: row.updated_at, handle: "alice", platform: "gitlab", tokens: { accessToken: "access", refreshToken: "refresh", expiresAt: null } } });
  expect(q.eq).toHaveBeenCalledWith("handle", "alice");
 });
 it.each([{ handle: "bob" }, { platform: "bitbucket" }, { updated_at: "invalid" }, { id: Number.MAX_SAFE_INTEGER + 1 }, { token_expires_at: "2026-02-30T00:00:00Z" }])("rejects malformed or mismatched rows", async change => {
  setup({ ...row, ...change });
  expect(await dbGetLinkedPlatformStrict("alice", "gitlab")).toEqual({ status: "unavailable", reasonCode: "invalid_record" });
 });
 it.each([{ access_token: "bad" }, { refresh_token: "bad" }])("does not classify decryption failure as unlinked", async change => {
  setup({ ...row, ...change });
  expect(await dbGetLinkedPlatformStrict("alice", "gitlab")).toEqual({ status: "unavailable", reasonCode: "credential_error" });
 });
});

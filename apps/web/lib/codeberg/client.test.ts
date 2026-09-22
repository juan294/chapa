import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCodebergIfLinked } from "./client";
import { fetchCodebergStats } from "./stats";
import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import type { StrictLinkedPlatform } from "@/lib/db/user-platforms";
vi.mock("@/lib/platform/fetch-linked-platform", () => ({ fetchLinkedPlatformStats: vi.fn().mockResolvedValue(null) }));
vi.mock("./stats", () => ({ fetchCodebergStats: vi.fn().mockResolvedValue(null) }));

const link: StrictLinkedPlatform = { id: "link1", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "codeberg", remoteLogin: "remote", tokens: { accessToken: "old", refreshToken: null, expiresAt: null } };
beforeEach(() => vi.clearAllMocks());
describe("codeberg legacy adapter", () => {
 it("forwards read-only mode to the authorization boundary", async () => {
  await fetchCodebergIfLinked("ALICE", "alice", { readOnly: true });
  expect(fetchLinkedPlatformStats).toHaveBeenCalledWith(expect.objectContaining({ platform: "codeberg", lowerHandle: "alice", readOnly: true }));
  expect(fetchCodebergStats).not.toHaveBeenCalled();
 });
 it("rejects mismatched owner arguments", async () => {
  expect(await fetchCodebergIfLinked("alice", "bob")).toBeNull();
  expect(fetchLinkedPlatformStats).not.toHaveBeenCalled();
 });
 it("collects with the precise resolved credential and linked login", async () => {
  await fetchCodebergIfLinked("alice", "alice");
  await vi.mocked(fetchLinkedPlatformStats).mock.calls[0]![0].fetchStats(link, "resolved");
  expect(fetchCodebergStats).toHaveBeenCalledWith("remote", "resolved", { displayName: "remote", avatarUrl: "" });
 });

});

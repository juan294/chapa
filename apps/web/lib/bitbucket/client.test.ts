import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBitbucketIfLinked } from "./client";
import { fetchBitbucketStats } from "./stats";
import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import type { StrictLinkedPlatform } from "@/lib/db/user-platforms";
vi.mock("@/lib/platform/fetch-linked-platform", () => ({ fetchLinkedPlatformStats: vi.fn().mockResolvedValue(null) }));
vi.mock("./stats", () => ({ fetchBitbucketStats: vi.fn().mockResolvedValue(null) }));

const link: StrictLinkedPlatform = { id: "link1", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "bitbucket", remoteLogin: "remote", tokens: { accessToken: "old", refreshToken: null, expiresAt: null } };
beforeEach(() => vi.clearAllMocks());
describe("bitbucket legacy adapter", () => {
 it("forwards read-only mode to the authorization boundary", async () => {
  await fetchBitbucketIfLinked("ALICE", "alice", { readOnly: true });
  expect(fetchLinkedPlatformStats).toHaveBeenCalledWith(expect.objectContaining({ platform: "bitbucket", lowerHandle: "alice", readOnly: true }));
  expect(fetchBitbucketStats).not.toHaveBeenCalled();
 });
 it("rejects mismatched owner arguments", async () => {
  expect(await fetchBitbucketIfLinked("alice", "bob")).toBeNull();
  expect(fetchLinkedPlatformStats).not.toHaveBeenCalled();
 });
 it("collects with the precise resolved credential and linked login", async () => {
  await fetchBitbucketIfLinked("alice", "alice");
  await vi.mocked(fetchLinkedPlatformStats).mock.calls[0]![0].fetchStats(link, "resolved");
  expect(fetchBitbucketStats).toHaveBeenCalledWith("remote", "resolved", { displayName: "remote", avatarUrl: "" });
 });

});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGitlabIfLinked } from "./client";
import { fetchGitlabStats } from "./stats";
import { fetchLinkedPlatformStats } from "@/lib/platform/fetch-linked-platform";
import type { StrictLinkedPlatform } from "@/lib/db/user-platforms";
vi.mock("@/lib/platform/fetch-linked-platform", () => ({ fetchLinkedPlatformStats: vi.fn().mockResolvedValue(null) }));
vi.mock("./stats", () => ({ fetchGitlabStats: vi.fn().mockResolvedValue(null) }));
import { fetchGitlabUser } from "@/lib/auth/gitlab";
vi.mock("@/lib/auth/gitlab", () => ({ fetchGitlabUser: vi.fn().mockResolvedValue({ id: 10, login: "remote" }) }));

const link: StrictLinkedPlatform = { id: "link1", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "remote", tokens: { accessToken: "old", refreshToken: null, expiresAt: null } };
beforeEach(() => vi.clearAllMocks());
describe("gitlab legacy adapter", () => {
 it("forwards read-only mode to the authorization boundary", async () => {
  await fetchGitlabIfLinked("ALICE", "alice", { readOnly: true });
  expect(fetchLinkedPlatformStats).toHaveBeenCalledWith(expect.objectContaining({ platform: "gitlab", lowerHandle: "alice", readOnly: true }));
  expect(fetchGitlabStats).not.toHaveBeenCalled();
 });
 it("rejects mismatched owner arguments", async () => {
  expect(await fetchGitlabIfLinked("alice", "bob")).toBeNull();
  expect(fetchLinkedPlatformStats).not.toHaveBeenCalled();
 });
 it("collects with the precise resolved credential and linked login", async () => {
  await fetchGitlabIfLinked("alice", "alice");
  await vi.mocked(fetchLinkedPlatformStats).mock.calls[0]![0].fetchStats(link, "resolved");
  expect(fetchGitlabStats).toHaveBeenCalledWith(10, "remote", "resolved", { displayName: "remote", avatarUrl: "" });
 });
 it("rejects a canonical user response for another linked login", async () => {
  vi.mocked(fetchGitlabUser).mockResolvedValueOnce({ id: 11, login: "other", full_name: "Other", avatar_url: "" });
  await fetchGitlabIfLinked("alice", "alice");
  expect(await vi.mocked(fetchLinkedPlatformStats).mock.calls[0]![0].fetchStats(link, "resolved")).toBeNull();
  expect(fetchGitlabStats).not.toHaveBeenCalled();
 });
});

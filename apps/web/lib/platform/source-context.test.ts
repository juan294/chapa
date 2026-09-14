import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoringWindow } from "@chapa/shared";
import { getNextauthSecret, getGithubToken } from "@/lib/env";
import { createSourceContext } from "./source-context";
vi.mock("@/lib/env", () => ({ getGithubToken: vi.fn(() => "server-token"), getNextauthSecret: vi.fn(() => "secret") }));
const input = { owner: "alice", requestedSource: { provider: "github" as const, host: "github.com", login: "alice" }, window: createScoringWindow("2026-09-05T12:00:00Z"), scope: { discovery: "explicit_repositories" as const, repositoryIds: ["repo1"], eventKinds: ["accepted_change" ] } };
afterEach(() => vi.restoreAllMocks());
describe("private effective credential context", () => {
 it("binds the exact credential actually given to the collector including server fallback", async () => {
  const fallback = createSourceContext(input, { kind: "github" });
  expect(await fallback.collect(async token => token)).toBe("server-token");
  expect(fallback.accessContextId).toBe(createSourceContext(input, { kind: "github", token: "server-token" }).accessContextId);
  expect(fallback.accessContextId).not.toBe(createSourceContext(input, { kind: "github", token: "other-principal" }).accessContextId);
 });
 it("retains exact explicit credentials and captures fallback once", async () => {
  for (const token of ["", " ", " explicit-token "]) {
   expect(await createSourceContext(input, { kind: "github", token }).collect(async effective => effective)).toBe(token);
  }
  const context = createSourceContext(input, { kind: "github" });
  vi.mocked(getGithubToken).mockReturnValue("rotated-server-token");
  expect(await context.collect(async token => token)).toBe("server-token");
  expect(context.accessContextId).not.toBe(createSourceContext(input, { kind: "github" }).accessContextId);
  vi.mocked(getGithubToken).mockReturnValue("server-token");
 });
 it("fails closed without a server secret and isolates secret rotation", () => {
  const first = createSourceContext(input, { kind: "github" }).accessContextId;
  vi.mocked(getNextauthSecret).mockReturnValue("rotated-secret");
  expect(createSourceContext(input, { kind: "github" }).accessContextId).not.toBe(first);
  vi.mocked(getNextauthSecret).mockReturnValue(undefined);
  expect(() => createSourceContext(input, { kind: "github" })).toThrow("Invalid source context");
  vi.mocked(getNextauthSecret).mockReturnValue("secret");
 });
 it("isolates subject, host, owner and declared scope", () => {
  const id = createSourceContext(input, { kind: "github" }).accessContextId;
  for (const change of [{ owner: "bob" }, { requestedSource: { ...input.requestedSource, login: "other-login" } }, { requestedSource: { ...input.requestedSource, host: "enterprise.example" } }, { scope: { ...input.scope, repositoryIds: ["repo2"] } }]) {
   expect(createSourceContext({ ...input, ...change }, { kind: "github" }).accessContextId).not.toBe(id);
  }
 });
 it("keeps access binding stable across time while isolating exact selection and inflight keys", () => {
  const current = createSourceContext(input, { kind: "github" });
  const later = createSourceContext({ ...input, window: createScoringWindow("2026-09-05T12:00:01Z") }, { kind: "github" });
  expect(current.accessContextId).toBe(later.accessContextId);
  expect(current.selectionId).not.toBe(later.selectionId);
 });
 it("binds relinks and refreshed effective tokens without exposing them in serialization or inspection", async () => {
  const linkedInput = { ...input, requestedSource: { provider: "gitlab" as const, host: "gitlab.com", login: "lab-user" } };
  const link = { id: "11111111-1111-4111-8111-111111111111", updatedAt: "2026-09-05T12:00:00.000001Z", handle: "alice", platform: "gitlab", remoteLogin: "lab-user", tokens: { accessToken: "old", refreshToken: null, expiresAt: null } };
  const make = (accessToken: string, updatedAt = link.updatedAt) => createSourceContext(linkedInput, { kind: "linked", link: { ...link, updatedAt }, accessToken });
  expect(() => createSourceContext(linkedInput, { kind: "linked", link: { ...link, handle: "bob" }, accessToken: "fresh-token" })).toThrow("Invalid source context");
  expect(() => createSourceContext(linkedInput, { kind: "linked", link: { ...link, platform: "bitbucket" }, accessToken: "fresh-token" })).toThrow("Invalid source context");
  const ctx = make("fresh-token");
  expect(await ctx.collect(async token => token)).toBe("fresh-token");
  expect(ctx.accessContextId).not.toBe(make("old").accessContextId);
  expect(ctx.accessContextId).not.toBe(make("fresh-token", "2026-09-05T12:00:00.000002Z").accessContextId);
  expect(JSON.stringify(ctx) + inspect(ctx)).not.toMatch(/fresh-token|old|[a-f0-9]{64}/);
 });
 it("rejects inconsistent windows", () => {
  expect(() => createSourceContext({ ...input, window: { ...input.window, startInclusive: input.window.endExclusive } }, { kind: "github" })).toThrow("Invalid source context");
 });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { issueObservedVerification } from "./redesign-fixtures";

// Regression: `assertShareVerification` (deployment-probes.ts) reads
// octocat's share page as a read-only smoke probe, extracts the
// `/verify/{token}` link the live render produced, then looks that exact
// token up via `/api/verify/{token}`. A v7.2 verification link needs a
// published receipt to exist first, and `runPublicProfileSideEffects` never
// persists one under `readOnly: true` — so on a genuinely cold seed (no
// earlier non-read-only render of /u/octocat), the lookup 404s regardless of
// the stats-cache envelope fix. `issueObservedVerification` must publish a
// real receipt through the same RPCs the scoring-point fixtures use and
// return the exact `v7.<revisionId>.<hexSignature>` token format the badge's
// verification strip links to, so a cold seed can pre-populate it.
describe("issueObservedVerification — publishes a real receipt and returns a v7 token", () => {
  const signing = "redesign-fixture-verification-regression-secret-0123456789abcdef";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    vi.stubEnv("CHAPA_VERIFICATION_SECRET", signing);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  function fakeDb() {
    const calls: { name: string; args: unknown }[] = [];
    const rpc = vi.fn((name: string, args: unknown) => {
      calls.push({ name, args });
      return Promise.resolve({ error: null, data: null });
    });
    return { calls, client: { rpc } as unknown as SupabaseClient };
  }

  it("ensures the subject, publishes the receipt, then issues its verification, in that order", async () => {
    const { calls, client } = fakeDb();

    const token = await issueObservedVerification(client, "octocat", new Date("2026-09-22T12:00:00.000Z"));

    expect(calls.map((call) => call.name)).toEqual([
      "scoring_v7_ensure_subject",
      "scoring_observed_publish_receipt",
      "scoring_v7_issue_verification",
    ]);
    expect(calls[0]!.args).toMatchObject({ p_owner: "octocat" });
    expect(calls[1]!.args).toMatchObject({ p_owner: "octocat", p_actor: "octocat" });
    expect(calls[2]!.args).toMatchObject({ p_owner: "octocat", p_actor: "octocat", p_key_version: "v7-1" });
    expect(token).toMatch(/^v7\.[0-9a-f-]+\.[0-9a-f]+$/);
  });

  it("requires CHAPA_VERIFICATION_SECRET before publishing anything", async () => {
    vi.unstubAllEnvs();
    const { calls, client } = fakeDb();

    await expect(issueObservedVerification(client, "octocat")).rejects.toThrow(
      "Explicit local verification secret required",
    );
    expect(calls).toHaveLength(0);
  });

  it("mints a different signature for a different owner", async () => {
    const first = fakeDb();
    const second = fakeDb();

    const tokenA = await issueObservedVerification(first.client, "octocat", new Date("2026-09-22T12:00:00.000Z"));
    const tokenB = await issueObservedVerification(second.client, "juan294", new Date("2026-09-22T12:00:00.000Z"));

    expect(tokenA).not.toBe(tokenB);
  });
});

import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { assertLocalSqlTarget } from "@/test/contract/local-sql";
import { issueScoreReceipt } from "@/lib/profile/issue-receipt";

/** Spawned only by the 100k DB contract, in a fresh process with local env. */
const child = process.env.SCORING_CHILD_ISSUANCE === "1" ? it : it.skip;

child("issues a published synthetic 100k generation without fixture arrays", async () => {
  assertLocalSqlTarget();
  const owner = process.env.SCORING_CHILD_OWNER;
  const referenceTime = process.env.SCORING_CHILD_REFERENCE;
  const output = process.env.SCORING_CHILD_OUTPUT;
  if (owner !== "contract-collection-queue" || referenceTime !== "2026-09-05T12:00:00.000Z" || !output
    || process.env.GITHUB_TOKEN) throw new Error("Synthetic local issuance context required");
  const db = getServiceClient();
  const generations = await db.from("scoring_collection_generations")
    .select("event_count,published_at").eq("owner_handle", owner);
  expect(generations.error).toBeNull();
  expect(generations.data?.reduce((sum, row) => sum + row.event_count, 0)).toBe(100_000);
  expect(generations.data?.every(row => row.published_at !== null)).toBe(true);
  let peakRssBytes = process.memoryUsage().rss;
  const rssTimer = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 50);
  const before = performance.now();
  const outcome = await issueScoreReceipt(owner, { referenceTime });
  const issuanceMs = performance.now() - before;
  clearInterval(rssTimer);
  expect(outcome).toEqual({ status: "issued" });
  const receipts = await db.from("scoring_v7_receipts")
    .select("policy_version,semantic_digest,core_semantic_digest").eq("owner_handle", owner);
  expect(receipts.error).toBeNull();
  expect(receipts.data).toHaveLength(1);
  expect(receipts.data?.[0]).toMatchObject({ policy_version: "v7.2",
    semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/),
    core_semantic_digest: expect.stringMatching(/^[0-9a-f]{64}$/) });
  writeFileSync(output, `${JSON.stringify({ issuanceMs, peakRssBytes, receiptCount: receipts.data?.length })}\n`);
}, 180_000);

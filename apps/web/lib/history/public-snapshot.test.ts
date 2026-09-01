import { describe, expect, it } from "vitest";
import { makeSnapshot } from "@/lib/test-helpers/fixtures";
import { redactSnapshotForVisitor } from "./public-snapshot";

describe("redactSnapshotForVisitor", () => {
  it("removes internal confidence fields without mutating the snapshot", () => {
    const snapshot = makeSnapshot({
      confidence: 81,
      confidencePenalties: [{ flag: "burst_activity", penalty: 15 }],
    });

    const publicSnapshot = redactSnapshotForVisitor(snapshot);

    expect(publicSnapshot).not.toHaveProperty("confidence");
    expect(publicSnapshot).not.toHaveProperty("confidencePenalties");
    expect(snapshot.confidence).toBe(81);
    expect(snapshot.confidencePenalties).toEqual([
      { flag: "burst_activity", penalty: 15 },
    ]);
  });
});

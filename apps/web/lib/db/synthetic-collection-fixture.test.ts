import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { engineeringEventKey } from "@chapa/shared";
import { syntheticCollectionEvents, syntheticCollectionSource } from "./synthetic-collection-fixture";

describe("synthetic collection benchmark fixture", () => {
  it("repeats the same byte shape and checksum for seed 294", () => {
    const first = syntheticCollectionEvents({ count: 100, seed: 294 });
    const second = syntheticCollectionEvents({ count: 100, seed: 294 });
    const bytes = Buffer.from(JSON.stringify(first));
    expect(second).toEqual(first);
    expect(createHash("sha256").update(bytes).digest("hex"))
      .toBe("27693cae9a74a61801dcaa0685d013a7192ab182a9e89b35c70c67fae6ce4b45");
    expect(bytes.length / first.length).toBeGreaterThan(1_200);
    expect(bytes.length / first.length).toBeLessThan(1_800);
    expect(gzipSync(bytes).length).toBeLessThan(bytes.length);
  });

  it("uses only generated identities and unique event keys at the observed size", () => {
    const events = syntheticCollectionEvents({ count: 17_572, seed: 294 });
    expect(new Set(events.map(engineeringEventKey)).size).toBe(events.length);
    expect(events.every((event) => event.subjectId === syntheticCollectionSource(294).subjectId)).toBe(true);
    expect(new Set(events.map((event) => event.repositoryId)).size).toBeGreaterThan(1);
    expect(events.some((event) => event.kind === "authored_commit")).toBe(true);
    expect(events.some((event) => event.kind === "accepted_change" && event.measurements.changedFiles.status === "observed" && event.measurements.changedFiles.value.length >= 12)).toBe(true);
    expect(events.some((event) => event.kind === "review")).toBe(true);
  });
});

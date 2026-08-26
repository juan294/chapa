import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { dbGetStudioConfig, dbUpsertStudioConfig } from "./studio";

const HANDLE = `contract-studio-${randomUUID()}`;

describe("Studio config durable boundary (contract)", () => {
  beforeEach(async () => {
    const db = getServiceClient();
    await db.from("studio_configs").delete().eq("handle", HANDLE);
  });

  afterAll(async () => {
    const db = getServiceClient();
    await db.from("studio_configs").delete().eq("handle", HANDLE);
  });

  it("persists and reads a validated BadgeConfig through PostgREST", async () => {
    const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };

    await expect(dbUpsertStudioConfig(HANDLE, config)).resolves.toEqual({
      ok: true,
    });
    await expect(dbGetStudioConfig(HANDLE)).resolves.toEqual({
      status: "found",
      config,
    });
  });

  it("reports malformed persisted JSON instead of returning it to callers", async () => {
    const db = getServiceClient();
    const { error } = await db.from("studio_configs").insert({
      handle: HANDLE,
      config: { ...DEFAULT_BADGE_CONFIG, background: "invalid" },
    });
    expect(error).toBeNull();

    await expect(dbGetStudioConfig(HANDLE)).resolves.toEqual({
      status: "invalid",
    });
  });
});

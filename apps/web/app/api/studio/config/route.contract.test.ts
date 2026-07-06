import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { describe, expect, it, vi } from "vitest";
import { declareField, generatePayloads, runMatrix } from "@/test/contract/payload-matrix";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockDbUpsertStudioConfig, mockRequireRequestSession } = vi.hoisted(() => ({
  mockDbUpsertStudioConfig: vi.fn(async () => true),
  mockRequireRequestSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
    error: null,
  })),
}));

vi.mock("@/lib/auth/session", () => ({
  getOptionalRequestSession: vi.fn(() => ({
    login: "octocat",
    name: "Octocat",
    avatar_url: "",
  })),
  getSessionSecret: vi.fn(() => "contract-nextauth-secret-32-characters"),
  requireRequestSession: mockRequireRequestSession,
}));

vi.mock("@/lib/db/studio", () => ({
  dbGetStudioConfig: vi.fn(async () => null),
  dbUpsertStudioConfig: mockDbUpsertStudioConfig,
}));

import { PUT } from "./route";

describe("PUT /api/studio/config contract", () => {
  it("runs the badge config payload matrix with zero unexpected 5xx", async () => {
    const payloads = generatePayloads({
      fields: [
        declareField("background", {
          candidates: [DEFAULT_BADGE_CONFIG.background, "aurora", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.background,
        }),
        declareField("cardStyle", {
          candidates: [DEFAULT_BADGE_CONFIG.cardStyle, "frost", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.cardStyle,
        }),
        declareField("border", {
          candidates: [DEFAULT_BADGE_CONFIG.border, "none", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.border,
        }),
        declareField("scoreEffect", {
          candidates: [DEFAULT_BADGE_CONFIG.scoreEffect, "chrome", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.scoreEffect,
        }),
        declareField("heatmapAnimation", {
          candidates: [DEFAULT_BADGE_CONFIG.heatmapAnimation, "ripple", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.heatmapAnimation,
        }),
        declareField("interaction", {
          candidates: [DEFAULT_BADGE_CONFIG.interaction, "tilt-3d", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.interaction,
        }),
        declareField("statsDisplay", {
          candidates: [DEFAULT_BADGE_CONFIG.statsDisplay, "animated-ease", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.statsDisplay,
        }),
        declareField("tierTreatment", {
          candidates: [DEFAULT_BADGE_CONFIG.tierTreatment, "enhanced", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.tierTreatment,
        }),
        declareField("celebration", {
          candidates: [DEFAULT_BADGE_CONFIG.celebration, "confetti", "invalid"],
          includeAbsent: true,
          includeNull: true,
          typical: DEFAULT_BADGE_CONFIG.celebration,
        }),
      ],
      seed: 0x57d10,
      randomCount: 80,
    });

    await runMatrix(
      payloads,
      (payload) =>
        invokeJson(PUT, {
          method: "PUT",
          path: "/api/studio/config",
          body: payload,
        }),
      { allowedStatuses: [400] },
    );
  });

  it("persists a valid badge config durably", async () => {
    const config = { ...DEFAULT_BADGE_CONFIG, background: "aurora" as const };
    const response = await invokeJson(PUT, {
      method: "PUT",
      path: "/api/studio/config",
      body: config,
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).success).toBe(true);
    expect(mockDbUpsertStudioConfig).toHaveBeenCalledWith("octocat", config);
  });

  it("fails closed when the durable config write fails", async () => {
    mockDbUpsertStudioConfig.mockResolvedValueOnce(false);

    const response = await invokeJson(PUT, {
      method: "PUT",
      path: "/api/studio/config",
      body: DEFAULT_BADGE_CONFIG,
    });

    expect(response.status).toBe(500);
    expect(bodyAsRecord(response)).toMatchObject({
      success: false,
      error: "Failed to persist studio config",
    });
  });
});

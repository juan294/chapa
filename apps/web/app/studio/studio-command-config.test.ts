import { describe, expect, it } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { getStudioCommandConfig } from "./studio-command-config";

describe("getStudioCommandConfig", () => {
  it("applies set, preset, and reset actions without mutating current config", () => {
    const current = { ...DEFAULT_BADGE_CONFIG, border: "none" as const };

    expect(
      getStudioCommandConfig(current, {
        type: "set",
        category: "background",
        value: "aurora",
      }),
    ).toEqual({ ...current, background: "aurora" });
    expect(
      getStudioCommandConfig(current, { type: "preset", name: "premium" }),
    ).toMatchObject({ background: "aurora", cardStyle: "smoke" });
    expect(getStudioCommandConfig(current, { type: "reset" })).toEqual(
      DEFAULT_BADGE_CONFIG,
    );
    expect(current).toEqual({ ...DEFAULT_BADGE_CONFIG, border: "none" });
  });

  it("resets an explicit Jade config to a fresh Ice config", () => {
    const saved = Object.freeze({ ...DEFAULT_BADGE_CONFIG, colorPalette: "jade" as const });
    const reset = getStudioCommandConfig(saved, { type: "reset" });
    expect(reset).toEqual({ ...DEFAULT_BADGE_CONFIG, colorPalette: "ice" });
    expect(reset).not.toBe(DEFAULT_BADGE_CONFIG);
    expect(saved.colorPalette).toBe("jade");
  });

  it("returns null for actions that do not change configuration", () => {
    expect(
      getStudioCommandConfig(DEFAULT_BADGE_CONFIG, { type: "save" }),
    ).toBeNull();
    expect(
      getStudioCommandConfig(DEFAULT_BADGE_CONFIG, {
        type: "preset",
        name: "unknown",
      }),
    ).toBeNull();
  });
});

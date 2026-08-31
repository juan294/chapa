import { describe, it, expect } from "vitest";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import {
  formatConfigCommands,
  formatConfigSummary,
} from "./studio-config-string";

describe("formatConfigSummary", () => {
  it("renders every shipping category as alias=value on one line", () => {
    expect(formatConfigSummary(DEFAULT_BADGE_CONFIG)).toBe(
      [
        "bg=solid",
        "card=flat",
        "border=solid-amber",
        "score=standard",
        "heatmap=fade-in",
        "tier=standard",
      ].join("  ·  "),
    );
  });

  it("follows the current configuration, not the default", () => {
    const summary = formatConfigSummary({
      ...DEFAULT_BADGE_CONFIG,
      background: "aurora",
    });
    expect(summary).toContain("bg=aurora");
    expect(summary).not.toContain("bg=solid");
  });
});

describe("formatConfigCommands", () => {
  it("emits one replayable /set command per category, in category order", () => {
    expect(formatConfigCommands(DEFAULT_BADGE_CONFIG).split("\n")).toEqual([
      "/set bg solid",
      "/set card flat",
      "/set border solid-amber",
      "/set score standard",
      "/set heatmap fade-in",
      "/set tier standard",
    ]);
  });

  it("emits no command for a category that no longer reaches the badge", () => {
    const commands = formatConfigCommands(DEFAULT_BADGE_CONFIG);
    expect(commands).not.toContain("interact");
    expect(commands).not.toContain("stats");
    expect(commands).not.toContain("celebrate");
  });
});

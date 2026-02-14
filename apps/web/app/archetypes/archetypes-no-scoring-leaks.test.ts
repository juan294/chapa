import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * These tests ensure archetype pages do NOT expose specific scoring methodology details
 * (weights, caps, formulas, thresholds) that constitute proprietary IP.
 */

const ARCHETYPE_DIR = join(__dirname);
const ARCHETYPE_NAMES = [
  "builder",
  "guardian",
  "marathoner",
  "polymath",
  "balanced",
  "emerging",
];

/** Patterns that reveal scoring methodology — none should appear in archetype pages */
const FORBIDDEN_PATTERNS = [
  // Percentage weights (e.g., "70%", "35%", "25%", "15%", "10%", "5%")
  /\d{1,2}%\)/,
  /\(\d{1,2}%/,

  // Specific threshold numbers in scoring context
  /score (?:70|60|50|40) or (?:higher|lower)/i,
  /score is (?:below|above|at least) \d+/i,
  /average (?:is|of) (?:60|40)/i,
  /reaches \d{2}/,

  // Specific caps
  /capped at \d+/i,
  /cap(?:ped)? at 5:1/i,

  // Spread thresholds
  /within 15 points/i,
  /15 points or less/i,

  // Specific number thresholds for burst detection
  /30\+ commits/,

  // Coefficient of variation (internal metric name)
  /coefficient of variation/i,

  // Logarithmic normalization details
  /logarithmic(?:ally)? normaliz/i,

  // Confidence score ranges
  /confidence.*(?:55|65)/i,
  /\(55[–-]65\)/,

  // Tie-breaking priority details
  /tie-breaking priority/i,

  // Specific signal caps
  /(?:15 repos|500 stars|200 forks|100 watchers)/,
];

describe("Archetype pages do not expose scoring methodology", () => {
  for (const archetype of ARCHETYPE_NAMES) {
    describe(archetype, () => {
      const filePath = join(ARCHETYPE_DIR, archetype, "page.tsx");
      const content = readFileSync(filePath, "utf-8");

      for (const pattern of FORBIDDEN_PATTERNS) {
        it(`does not contain pattern: ${pattern.source}`, () => {
          expect(content).not.toMatch(pattern);
        });
      }
    });
  }
});

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

  // Specific threshold numbers in scoring context (V4: 70/60/50/40, V5: 60/50/40/25)
  /score (?:70|60|50|40|25) or (?:higher|lower)/i,
  /score is (?:below|above|at least) \d+/i,
  /average (?:is|of|below|above) (?:60|50|40|25)/i,
  /reaches \d{2}/,

  // Specific caps
  /capped at \d+/i,
  /cap(?:ped)? at 5:1/i,

  // Spread thresholds (V4: 15, V5: 20)
  /within \d+ points/i,
  /\d+ points or less/i,

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

  // Specific signal caps (V4 and V5 values)
  /(?:15 repos|12 repos|500 stars|150 stars|200 forks|80 forks|100 watchers|50 watchers)/,

  // Square root / sqrt formula details (V5 internal)
  /square root of activeDays/i,
  /sqrt\(/,
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

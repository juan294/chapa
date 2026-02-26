import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminUserTable.tsx"),
  "utf-8",
);

describe("AdminUserTable", () => {
  describe("#518 — aria-label on table", () => {
    it("table element has aria-label 'Registered users'", () => {
      expect(SOURCE).toContain('aria-label="Registered users"');
    });
  });

  describe("#519 — ARIA progressbar on confidence bar", () => {
    it("confidence bar has role='progressbar'", () => {
      // The confidence column section should contain a progressbar role
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain('role="progressbar"');
    });

    it("confidence bar has aria-valuenow bound to user.confidence", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuenow={user.confidence}");
    });

    it("confidence bar has aria-valuemin={0}", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuemin={0}");
    });

    it("confidence bar has aria-valuemax={100}", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuemax={100}");
    });

    it("confidence bar has aria-label 'Confidence score'", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain('aria-label="Confidence score"');
    });
  });
});

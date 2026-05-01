import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const API_DIR = path.resolve(__dirname, "../../app/api");

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === "route.ts") {
      results.push(full);
    }
  }
  return results;
}

describe("withErrorCapture coverage — all API routes", () => {
  const routeFiles = findRouteFiles(API_DIR);

  it("finds at least 40 route files", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(40);
  });

  for (const file of routeFiles) {
    const relativePath = path.relative(API_DIR, file);
    it(`${relativePath} uses withErrorCapture`, () => {
      const content = fs.readFileSync(file, "utf-8");
      expect(
        content,
        `${relativePath} must import or use withErrorCapture`,
      ).toContain("withErrorCapture");
    });
  }
});

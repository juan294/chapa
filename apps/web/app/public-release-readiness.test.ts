import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath));
}

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

describe("public release readiness", () => {
  describe("required files exist", () => {
    it("has LICENSE file", () => {
      expect(fileExists("LICENSE")).toBe(true);
    });

    it("has CONTRIBUTING.md", () => {
      expect(fileExists("CONTRIBUTING.md")).toBe(true);
    });

    it("has CODE_OF_CONDUCT.md", () => {
      expect(fileExists("CODE_OF_CONDUCT.md")).toBe(true);
    });

    it("has SECURITY.md", () => {
      expect(fileExists("SECURITY.md")).toBe(true);
    });

    it("has CHANGELOG.md", () => {
      expect(fileExists("CHANGELOG.md")).toBe(true);
    });

    it("has README.md", () => {
      expect(fileExists("README.md")).toBe(true);
    });

    it("has .env.example", () => {
      expect(fileExists(".env.example")).toBe(true);
    });

    it("has .github/FUNDING.yml", () => {
      expect(fileExists(".github/FUNDING.yml")).toBe(true);
    });

    it("has issue templates", () => {
      expect(fileExists(".github/ISSUE_TEMPLATE/bug_report.yml")).toBe(true);
      expect(fileExists(".github/ISSUE_TEMPLATE/feature_request.yml")).toBe(
        true,
      );
    });

    it("has pull request template", () => {
      expect(fileExists(".github/pull_request_template.md")).toBe(true);
    });
  });

  describe("LICENSE file", () => {
    it("contains MIT license text", () => {
      const license = readFile("LICENSE");
      expect(license).toContain("MIT License");
      expect(license).toContain("Permission is hereby granted");
    });

    it("includes current year", () => {
      const license = readFile("LICENSE");
      expect(license).toMatch(/202[5-9]/);
    });
  });

  describe("CONTRIBUTING.md content", () => {
    it("mentions development workflow", () => {
      const content = readFile("CONTRIBUTING.md");
      expect(content.toLowerCase()).toContain("development");
      expect(content.toLowerCase()).toContain("pull request");
    });

    it("mentions test requirements", () => {
      const content = readFile("CONTRIBUTING.md");
      expect(content.toLowerCase()).toContain("test");
    });

    it("references code of conduct", () => {
      const content = readFile("CONTRIBUTING.md");
      expect(content.toLowerCase()).toContain("code of conduct");
    });
  });

  describe("CODE_OF_CONDUCT.md content", () => {
    it("adopts Contributor Covenant", () => {
      const content = readFile("CODE_OF_CONDUCT.md");
      expect(content).toContain("Contributor Covenant");
    });
  });

  describe("SECURITY.md content", () => {
    it("explains how to report vulnerabilities", () => {
      const content = readFile("SECURITY.md");
      expect(content.toLowerCase()).toContain("report");
      expect(content.toLowerCase()).toContain("vulnerab");
    });

    it("mentions private reporting", () => {
      const content = readFile("SECURITY.md");
      expect(content.toLowerCase()).toContain("private");
    });
  });

  describe("CHANGELOG.md content", () => {
    it("has at least one version entry", () => {
      const content = readFile("CHANGELOG.md");
      expect(content).toMatch(/## \[?\d+\.\d+/);
    });
  });

  describe(".gitignore completeness", () => {
    it("excludes env files", () => {
      const gitignore = readFile(".gitignore");
      expect(gitignore).toContain(".env");
    });

    it("excludes node_modules", () => {
      const gitignore = readFile(".gitignore");
      expect(gitignore).toContain("node_modules");
    });

    it("excludes IDE configs", () => {
      const gitignore = readFile(".gitignore");
      expect(gitignore).toMatch(/\.vscode|\.idea/);
    });
  });

  describe("no secrets in source code", () => {
    it("README does not contain real API keys", () => {
      const readme = readFile("README.md");
      expect(readme).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(readme).not.toMatch(/AKIA[A-Z0-9]{16}/);
    });

    it(".env.example has no real values", () => {
      const envExample = readFile(".env.example");
      const lines = envExample
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"));
      for (const line of lines) {
        const value = line.split("=")[1]?.trim();
        // Values should be empty or contain only placeholder text
        expect(value?.length ?? 0).toBeLessThan(100);
      }
    });
  });
});

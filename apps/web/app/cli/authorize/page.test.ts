import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

describe("CliAuthorizePage", () => {
  describe("server component", () => {
    it("exports a default async function", () => {
      expect(SOURCE).toContain("export default async function CliAuthorizePage");
    });

    it("does NOT have 'use client' directive (server component)", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
    });
  });

  describe("session parameter handling", () => {
    it("reads session from searchParams", () => {
      expect(SOURCE).toContain("params.session");
    });

    it("shows error when session parameter is missing", () => {
      expect(SOURCE).toContain("Missing session parameter");
    });

    it("instructs user to run chapa login", () => {
      expect(SOURCE).toContain("chapa login");
    });
  });

  describe("authentication check", () => {
    it("reads the shared session secret helper", () => {
      expect(SOURCE).toContain("getSessionSecret");
    });

    it("redirects to home when secret is missing", () => {
      expect(SOURCE).toContain('redirect("/")');
    });

    it("reads server session via the shared helper", () => {
      expect(SOURCE).toContain("getOptionalServerSessionFromHeaders");
    });

    it("redirects unauthenticated users to login", () => {
      expect(SOURCE).toContain("/api/auth/login");
    });

    it("preserves return URL with session param in redirect", () => {
      expect(SOURCE).toContain("encodeURIComponent(sessionId)");
    });
  });

  describe("authenticated flow", () => {
    it("renders AuthorizeClient for authenticated users", () => {
      expect(SOURCE).toContain("<AuthorizeClient");
    });

    it("passes sessionId to AuthorizeClient", () => {
      expect(SOURCE).toContain("sessionId={sessionId}");
    });

    it("passes handle from session to AuthorizeClient", () => {
      expect(SOURCE).toContain("handle={session.login}");
    });
  });

  describe("missing session UI", () => {
    it("has a main landmark with id", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("has an h1 heading", () => {
      expect(SOURCE).toContain("<h1");
    });

    it("heading says 'Authorize Chapa CLI'", () => {
      expect(SOURCE).toContain("Authorize Chapa CLI");
    });
  });

  describe("design system compliance", () => {
    it("uses semantic background tokens", () => {
      expect(SOURCE).toContain("bg-bg");
      expect(SOURCE).toContain("bg-card");
    });

    it("uses terminal-red for error text", () => {
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("uses font-heading for heading", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses stroke border token", () => {
      expect(SOURCE).toContain("border-stroke");
    });
  });

  describe("imports", () => {
    it("imports redirect from next/navigation", () => {
      expect(SOURCE).toContain("redirect");
      expect(SOURCE).toContain("next/navigation");
    });

    it("imports headers from next/headers", () => {
      expect(SOURCE).toContain("headers");
      expect(SOURCE).toContain("next/headers");
    });

    it("imports shared session helpers", () => {
      expect(SOURCE).toContain("getOptionalServerSessionFromHeaders");
      expect(SOURCE).toContain("getSessionSecret");
      expect(SOURCE).toContain("@/lib/auth/session");
    });

    it("imports AuthorizeClient", () => {
      expect(SOURCE).toContain("AuthorizeClient");
    });
  });
});

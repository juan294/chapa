import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AuthorizeClient.tsx"),
  "utf-8",
);

describe("AuthorizeClient (#246)", () => {
  describe("client component", () => {
    it("has 'use client' directive (uses hooks)", () => {
      expect(SOURCE).toMatch(/^["']use client["']/m);
    });

    it("uses useState for state management", () => {
      expect(SOURCE).toContain("useState");
    });
  });

  describe("state machine", () => {
    it("starts in idle state", () => {
      expect(SOURCE).toContain('"idle"');
    });

    it("supports approving state", () => {
      expect(SOURCE).toContain('"approving"');
    });

    it("supports approved state", () => {
      expect(SOURCE).toContain('"approved"');
    });

    it("supports error state", () => {
      expect(SOURCE).toContain('"error"');
    });

    it("state type is a union of idle | approving | approved | error", () => {
      expect(SOURCE).toContain(
        '"idle" | "approving" | "approved" | "error"',
      );
    });
  });

  describe("approve flow", () => {
    it("calls the /api/cli/auth/approve endpoint", () => {
      expect(SOURCE).toContain('"/api/cli/auth/approve"');
    });

    it("sends POST request", () => {
      expect(SOURCE).toContain('method: "POST"');
    });

    it("sends JSON content type", () => {
      expect(SOURCE).toContain('"Content-Type": "application/json"');
    });

    it("sends sessionId in the request body", () => {
      expect(SOURCE).toContain("JSON.stringify({ sessionId })");
    });

    it("transitions to approving state before fetch", () => {
      expect(SOURCE).toContain('setState("approving")');
    });

    it("transitions to approved state on success", () => {
      expect(SOURCE).toContain('setState("approved")');
    });

    it("transitions to error state on fetch failure", () => {
      // Both non-ok response and catch block should set error
      const errorStateCount = (
        SOURCE.match(/setState\("error"\)/g) || []
      ).length;
      expect(errorStateCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("props", () => {
    it("accepts sessionId prop", () => {
      expect(SOURCE).toContain("sessionId: string");
    });

    it("accepts handle prop", () => {
      expect(SOURCE).toContain("handle: string");
    });
  });

  describe("UI states", () => {
    it("shows success message in approved state", () => {
      expect(SOURCE).toContain(
        "Authorized! You can close this tab and return to your terminal.",
      );
    });

    it("shows CLI requesting access message", () => {
      expect(SOURCE).toContain(
        "The Chapa CLI is requesting access to your account.",
      );
    });

    it("displays the user handle", () => {
      expect(SOURCE).toContain("{handle}");
    });

    it("shows 'Logged in as' label", () => {
      expect(SOURCE).toContain("Logged in as");
    });

    it("shows permissions explanation text", () => {
      expect(SOURCE).toContain("upload supplemental stats");
    });

    it("shows error message when state is error", () => {
      expect(SOURCE).toContain("Failed to authorize. Please try again.");
    });

    it("shows 'Authorizing...' text while approving", () => {
      expect(SOURCE).toContain("Authorizing...");
    });

    it("shows 'Authorize CLI' text when idle", () => {
      expect(SOURCE).toContain("Authorize CLI");
    });
  });

  describe("button behavior", () => {
    it("disables button during approving state", () => {
      expect(SOURCE).toContain('disabled={state === "approving"}');
    });

    it("has disabled opacity style", () => {
      expect(SOURCE).toContain("disabled:opacity-50");
    });
  });

  describe("design system compliance", () => {
    it("uses primary button styles (bg-amber)", () => {
      expect(SOURCE).toContain("bg-amber");
    });

    it("uses white text on button", () => {
      expect(SOURCE).toContain("text-white");
    });

    it("uses rounded-lg on button (not rounded-full)", () => {
      expect(SOURCE).toContain("rounded-lg");
      expect(SOURCE).not.toContain("rounded-full");
    });

    it("uses font-heading for title", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses terminal-green for success state", () => {
      expect(SOURCE).toContain("text-terminal-green");
    });

    it("uses terminal-red for error state", () => {
      expect(SOURCE).toContain("text-terminal-red");
    });

    it("uses semantic background tokens", () => {
      expect(SOURCE).toContain("bg-bg");
      expect(SOURCE).toContain("bg-card");
    });

    it("uses semantic text tokens", () => {
      expect(SOURCE).toContain("text-text-primary");
      expect(SOURCE).toContain("text-text-secondary");
    });

    it("uses stroke border token", () => {
      expect(SOURCE).toContain("border-stroke");
    });

    it("uses amber accent for handle display", () => {
      expect(SOURCE).toContain("text-amber");
    });
  });

  describe("layout", () => {
    it("uses min-h-screen for full page height", () => {
      expect(SOURCE).toContain("min-h-screen");
    });

    it("centers content with flexbox", () => {
      expect(SOURCE).toContain("items-center justify-center");
    });

    it("constrains card width with max-w-md", () => {
      expect(SOURCE).toContain("max-w-md");
    });
  });

  describe("accessibility", () => {
    it("has a main landmark element", () => {
      expect(SOURCE).toContain("<main");
    });

    it("has id on main for skip link target", () => {
      expect(SOURCE).toContain('id="main-content"');
    });

    it("uses h1 for page title", () => {
      expect(SOURCE).toContain("<h1");
    });
  });
});

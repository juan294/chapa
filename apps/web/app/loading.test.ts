// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import RootLoading from "./loading";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "loading.tsx"),
  "utf-8",
);

afterEach(cleanup);

describe("Root loading.tsx", () => {
  describe("render", () => {
    it("renders a status landmark with an accessible loading label", () => {
      render(RootLoading());
      const status = screen.getByRole("status");
      expect(status.tagName).toBe("MAIN");
      expect(status.id).toBe("main-content");
      expect(status.getAttribute("aria-label")).toBeTruthy();
    });

    it("has sr-only text for screen readers", () => {
      const { container } = render(RootLoading());
      expect(container.querySelector(".sr-only")?.textContent).toBeTruthy();
    });

    it("marks decorative elements aria-hidden", () => {
      const { container } = render(RootLoading());
      expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    });
  });

  // #1109 (UX-H3) — this is deliberately a server component with no client
  // hooks: the top-level Suspense fallback shown across every route, so it
  // must render instantly without waiting on client JS. jsdom would render a
  // client-hook version identically, so this guard has no render-observable
  // equivalent.
  describe("lightweight implementation", () => {
    it("is a server component (no 'use client' directive) and does not import client hooks", () => {
      expect(SOURCE).not.toMatch(/^["']use client["']/m);
      expect(SOURCE).not.toContain("useState");
      expect(SOURCE).not.toContain("useEffect");
      expect(SOURCE).not.toContain("useRef");
    });
  });
});

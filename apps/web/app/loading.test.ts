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
    it("renders a status region with an accessible loading label", () => {
      render(RootLoading());
      const status = screen.getByRole("status");
      expect(status.getAttribute("aria-label")).toBeTruthy();
    });

    // LE-5-3 — the fallback streams beside the page's own <main> until React
    // swaps them, so a fallback that is itself `main#main-content` duplicates
    // the landmark element and the skip-link id for that whole window. It
    // never was a main landmark anyway: role="status" overrides <main>'s
    // implicit role, so nothing is lost by making the element a <div>.
    it("does not claim the page's main landmark or skip-link target", () => {
      const { container } = render(RootLoading());
      expect(container.querySelector("main")).toBeNull();
      expect(container.querySelector("#main-content")).toBeNull();
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

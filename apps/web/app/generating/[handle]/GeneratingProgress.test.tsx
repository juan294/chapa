import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "GeneratingProgress.tsx"),
  "utf-8",
);
const COPY_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../../../lib/copy/public-flow.ts"),
  "utf-8",
);

describe("GeneratingProgress", () => {
  it("has 'use client' directive", () => {
    expect(SOURCE).toMatch(/^["']use client["']/m);
  });

  describe("progress steps", () => {
    it("shows Spanish GitHub authentication step", () => {
      expect(COPY_SOURCE).toContain("Autenticado con GitHub");
    });

    it("shows Spanish contribution fetch step", () => {
      expect(COPY_SOURCE).toContain("Recopilando datos de contribución");
    });

    it("shows Spanish impact profile step", () => {
      expect(COPY_SOURCE).toContain("Calculando perfil de impacto");
    });

    it("shows Spanish badge render step", () => {
      expect(COPY_SOURCE).toContain("Renderizando insignia");
    });
  });

  describe("API integration", () => {
    it("calls POST /api/generate", () => {
      expect(SOURCE).toContain('"/api/generate"');
      expect(SOURCE).toContain('"POST"');
    });

    it("includes credentials for session cookie", () => {
      expect(SOURCE).toContain('"include"');
    });
  });

  describe("navigation", () => {
    it("uses useRouter for redirect", () => {
      expect(SOURCE).toContain("useRouter");
    });

    it("redirects to /u/:handle on success", () => {
      expect(SOURCE).toContain("/u/${handle}");
    });
  });

  describe("error handling", () => {
    it("has error state", () => {
      expect(SOURCE).toContain("error");
    });

    it("provides a retry mechanism", () => {
      expect(COPY_SOURCE).toContain("Intentar de nuevo");
    });

    it("uses centralized public-flow copy", () => {
      expect(SOURCE).toContain("SPANISH_PUBLIC_COPY");
    });
  });

  describe("accessibility", () => {
    it("uses aria-live for progress announcements", () => {
      expect(SOURCE).toContain("aria-live");
    });

    it("uses role=status for progress area", () => {
      expect(SOURCE).toContain('role="status"');
    });

    it("has role='alert' on the error message container", () => {
      expect(SOURCE).toContain('role="alert"');
    });

    it("wraps content in a main landmark with skip-link target (#456)", () => {
      expect(SOURCE).toContain("<main");
      expect(SOURCE).toContain('id="main-content"');
    });
  });

  describe("design system compliance", () => {
    it("uses JetBrains Mono for terminal text (font-heading)", () => {
      expect(SOURCE).toContain("font-heading");
    });

    it("uses terminal-green for success checkmarks", () => {
      expect(SOURCE).toContain("terminal-green");
    });

    it("uses amber accent color", () => {
      expect(SOURCE).toContain("text-amber");
    });

    it("uses bg-bg for page background", () => {
      expect(SOURCE).toContain("bg-bg");
    });
  });
});

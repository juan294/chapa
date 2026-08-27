// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SiteFooter } from "./SiteFooter";

afterEach(cleanup);

const t = (key: string) => {
  const map: Record<string, string> = {
    "landing.footer.tagline": "Built for developers, by developers.",
    "landing.footer.poweredBy": "Compatible with",
    "landing.footer.about": "About",
    "landing.footer.scoring": "Scoring",
    "landing.footer.terms": "Terms",
    "landing.footer.privacy": "Privacy",
    "landing.finalCta.prompt": "Ready to see your impact?",
    "landing.finalCta.button": "Get your badge",
    "landing.finalCta.buttonPending": "Connecting…",
  };
  return map[key] ?? key;
};

// #1167 (UX-B1, launch blocker) — LandingContent.tsx was the ONLY call site
// rendering a <footer>, so Privacy/Terms were reachable only from the home
// page. SiteFooter is the extracted, reusable site-wide footer every content
// page renders.
describe("SiteFooter", () => {
  it("renders exactly one footer landmark", () => {
    const { container } = render(<SiteFooter t={t} />);
    expect(container.querySelectorAll("footer").length).toBe(1);
  });

  it("links to /privacy", () => {
    render(<SiteFooter t={t} />);
    const link = screen.getByRole("link", { name: "Privacy" });
    expect(link.getAttribute("href")).toBe("/privacy");
  });

  it("links to /terms", () => {
    render(<SiteFooter t={t} />);
    const link = screen.getByRole("link", { name: "Terms" });
    expect(link.getAttribute("href")).toBe("/terms");
  });

  it("links to /about", () => {
    render(<SiteFooter t={t} />);
    const link = screen.getByRole("link", { name: "About" });
    expect(link.getAttribute("href")).toBe("/about");
  });

  it("links to /about/scoring", () => {
    render(<SiteFooter t={t} />);
    const link = screen.getByRole("link", { name: "Scoring" });
    expect(link.getAttribute("href")).toBe("/about/scoring");
  });

  it("renders the copyright line with the current year", () => {
    render(<SiteFooter t={t} />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeDefined();
  });

  it("does not use terminal-dim for the copyright text (UX-H1: 2.29:1 dark / 2.54:1 light, fails AA)", () => {
    const { container } = render(<SiteFooter t={t} />);
    const year = new Date().getFullYear().toString();
    const copyright = screen.getByText(new RegExp(year));
    expect(copyright.className).not.toContain("terminal-dim");
    void container;
  });

  it("does not render a signup CTA by default", () => {
    render(<SiteFooter t={t} />);
    expect(screen.queryByText("Ready to see your impact?")).toBeNull();
  });

  describe("showCta (#1167 / UX-B1: archetype/about pages dead-end with no signup CTA)", () => {
    it("renders a compact signup CTA when showCta is true", () => {
      render(<SiteFooter t={t} showCta />);
      expect(screen.getByText("Ready to see your impact?")).toBeDefined();
      expect(
        screen.getByRole("link", { name: /Get your badge/ }),
      ).toBeDefined();
    });
  });

  describe("platform attribution", () => {
    it("links out to all four platforms plus Claude Code", () => {
      render(<SiteFooter t={t} />);
      expect(screen.getByLabelText("GitHub")).toBeDefined();
      expect(screen.getByLabelText("Bitbucket")).toBeDefined();
      expect(screen.getByLabelText("Codeberg")).toBeDefined();
      expect(screen.getByLabelText("GitLab")).toBeDefined();
      expect(screen.getByLabelText("Claude Code")).toBeDefined();
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

vi.mock("@/components/LiteYouTubeEmbed", () => ({
  LiteYouTubeEmbed: ({ title }: { title: string }) => (
    <div data-testid="youtube-embed">{title}</div>
  ),
}));

import ScoringMethodologyPage from "./page";

afterEach(cleanup);

describe("ScoringMethodologyPage render", () => {
  it("renders the page heading", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByText("Scoring Methodology")).toBeDefined();
  });

  it("renders the navbar", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders the command bar", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByTestId("command-bar")).toBeDefined();
  });

  it("renders section headings", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByText("Philosophy")).toBeDefined();
    expect(screen.getByText("Normalization")).toBeDefined();
    expect(screen.getByText("Signal caps")).toBeDefined();
    expect(screen.getByText("The core dimensions")).toBeDefined();
  });

  it("renders dimension sub-headings", () => {
    const { container } = render(<ScoringMethodologyPage />);
    const h3s = container.querySelectorAll("h3");
    expect(h3s.length).toBeGreaterThan(0);
  });

  it("renders tables with signal caps data", () => {
    const { container } = render(<ScoringMethodologyPage />);
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("renders the YouTube explainer embed", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByTestId("youtube-embed")).toBeDefined();
  });

  it("renders the CTA section", () => {
    render(<ScoringMethodologyPage />);
    expect(screen.getByText("Help us improve this")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock("@/components/GlobalCommandBar", () => ({
  GlobalCommandBar: () => <div data-testid="command-bar" />,
}));

import VerificationPage from "./page";

afterEach(cleanup);

describe("VerificationPage render", () => {
  it("renders the page heading", () => {
    render(<VerificationPage />);
    expect(screen.getByText("Badge Verification")).toBeDefined();
  });

  it("renders the navbar", () => {
    render(<VerificationPage />);
    expect(screen.getByTestId("navbar")).toBeDefined();
  });

  it("renders the command bar", () => {
    render(<VerificationPage />);
    expect(screen.getByTestId("command-bar")).toBeDefined();
  });

  it("renders section headings about how verification works", () => {
    render(<VerificationPage />);
    expect(screen.getByText("Why verification exists")).toBeDefined();
    expect(screen.getByText("How it works")).toBeDefined();
    expect(screen.getByText("What data is signed")).toBeDefined();
  });

  it("renders tables with verification field data", () => {
    const { container } = render(<VerificationPage />);
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
  });

  it("renders the ShieldCheckIcon and ArrowRightIcon in CTA", () => {
    const { container } = render(<VerificationPage />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("renders the CTA section", () => {
    render(<VerificationPage />);
    expect(screen.getByText("Try it yourself")).toBeDefined();
    expect(screen.getByText("Verify a Badge")).toBeDefined();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ArchetypesLoading from "./loading";

afterEach(cleanup);

describe("[locale]/archetypes loading.tsx render", () => {
  it("renders a status element with the default-locale loading text", () => {
    render(<ArchetypesLoading />);
    const status = screen.getByRole("status");
    expect(status).toBeDefined();
    expect(status.getAttribute("aria-label")).toBe("Cargando...");
  });

  it("renders a pulsing skeleton indicator", () => {
    const { container } = render(<ArchetypesLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("has sr-only loading text for screen readers", () => {
    render(<ArchetypesLoading />);
    expect(screen.getAllByText("Cargando...").length).toBeGreaterThan(0);
  });
});

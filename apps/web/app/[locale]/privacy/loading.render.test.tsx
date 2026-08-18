// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PrivacyLoading from "./loading";

afterEach(cleanup);

describe("[locale]/privacy loading.tsx render", () => {
  it("renders a status element with the default-locale loading text", () => {
    render(<PrivacyLoading />);
    const status = screen.getByRole("status");
    expect(status).toBeDefined();
    expect(status.getAttribute("aria-label")).toBe("Cargando...");
  });

  it("renders a pulsing skeleton indicator", () => {
    const { container } = render(<PrivacyLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("has sr-only loading text for screen readers", () => {
    render(<PrivacyLoading />);
    expect(screen.getAllByText("Cargando...").length).toBeGreaterThan(0);
  });
});

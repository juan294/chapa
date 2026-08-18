// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RootLoading from "./loading";

afterEach(cleanup);

describe("RootLoading render", () => {
  it("renders a status element", () => {
    render(<RootLoading />);
    expect(screen.getByRole("status")).toBeDefined();
  });

  // #1109 (UX-H3): sourced from the DEFAULT_LOCALE ('es', #861) dictionary
  // rather than a hardcoded English literal — this static server component
  // (no client hooks) always renders Spanish, matching the rest of the root
  // layout's DEFAULT_LOCALE-first static rendering.
  it("has sr-only loading text", () => {
    render(<RootLoading />);
    expect(screen.getByText("Cargando Chapa...")).toBeDefined();
  });
});

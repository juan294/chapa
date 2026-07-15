// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ExperimentsLoading from "./loading";

afterEach(cleanup);

describe("ExperimentsLoading render", () => {
  it("renders a status region with the loading label", () => {
    render(<ExperimentsLoading />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
  });

  it("has sr-only loading text", () => {
    render(<ExperimentsLoading />);
    expect(screen.getByText("Loading experiment...")).toBeDefined();
  });
});

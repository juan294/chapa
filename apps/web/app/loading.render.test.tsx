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

  it("has sr-only loading text", () => {
    render(<RootLoading />);
    expect(screen.getByText("Loading Chapa...")).toBeDefined();
  });
});

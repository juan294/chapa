// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

afterEach(cleanup);

describe("text-effects experiment page", () => {
  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () => {
    const MockComponent = () => <div data-testid="global-command-bar" />;
    MockComponent.displayName = "DynamicMock";
    return MockComponent;
  },
}));

import { GlobalCommandBarLazy } from "./GlobalCommandBarLazy";

afterEach(cleanup);

describe("GlobalCommandBarLazy render", () => {
  it("renders the lazy-loaded component wrapper", () => {
    render(<GlobalCommandBarLazy />);
    expect(screen.getByTestId("global-command-bar")).toBeDefined();
  });
});

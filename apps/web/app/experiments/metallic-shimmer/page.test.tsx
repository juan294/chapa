// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "page.tsx"),
  "utf-8",
);

// Mock clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe("metallic-shimmer experiment page", () => {
  afterEach(cleanup);

  it("SVG metallic score aria-label uses i18n key (not hardcoded English)", () => {
    // Verify the page uses the i18n aria.impactScoreTier key instead of a
    // hardcoded template literal `Impact score ${score}, tier ${tier} ...`.
    expect(SOURCE).toContain("aria.impactScoreTier");
    expect(SOURCE).not.toMatch(/aria-label=\{`Impact score \$\{score\}/);
  });

  it("renders without throwing", async () => {
    const { default: Page } = await import("./page");
    const { container } = render(<Page />);
    expect(container.querySelector("main")).toBeTruthy();
  });

  it("updates shimmer controls and replays animation", async () => {
    const { default: Page } = await import("./page");
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/Speed:/), {
      target: { value: "4.5" },
    });
    fireEvent.change(screen.getByLabelText(/Highlight intensity:/), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replay Animation" }));

    expect(screen.getByText("4.5s")).toBeTruthy();
    expect(screen.getByText("75%")).toBeTruthy();
    // aria-label now comes from i18n (aria.impactScoreTier key, English fallback in tests)
    expect(
      screen.getByRole("img", {
        name: /Impact score 87, tier Elite/,
      }),
    ).toBeTruthy();
  });
});

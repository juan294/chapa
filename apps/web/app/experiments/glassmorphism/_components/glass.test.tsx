// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BackgroundBlobs } from "./BackgroundBlobs";
import { StatCard, Toggle } from "./controls";
import { presetToStyle, glassStyle, PRESETS } from "./glass-core";

afterEach(cleanup);

describe("glassmorphism extracted components", () => {
  it("BackgroundBlobs renders four blobs when visible and nothing when hidden", () => {
    const { container, rerender } = render(<BackgroundBlobs visible />);
    expect(container.querySelectorAll(".rounded-full").length).toBe(4);
    rerender(<BackgroundBlobs visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("StatCard renders the value and a percentage-width progress bar", () => {
    const { container } = render(
      <StatCard
        label="Delivery"
        value={34}
        maxValue={40}
        detail="detail"
        style={presetToStyle("medium", true)}
      />,
    );
    expect(container.textContent).toContain("34");
    const bar = container.querySelector(".bg-amber\\/70") as HTMLElement;
    expect(bar.style.width).toBe("85%");
  });

  it("Toggle reflects checked state via aria-checked and fires onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <Toggle checked={false} onChange={onChange} label="Blobs" />,
    );
    const sw = getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    sw.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("presetToStyle uses an amber-tinted background only for the amber variant", () => {
    expect(presetToStyle("amber", true).background).toContain("139, 92, 246");
    expect(presetToStyle("medium", true).background).toContain("19, 20, 30");
  });

  it("glassStyle drops the border when showBorder is false", () => {
    const style = glassStyle({
      bgOpacity: PRESETS.medium.bgOpacity,
      blur: 20,
      saturation: 150,
      borderOpacity: 0.15,
      showBorder: false,
    });
    expect(style.border).toBe("1px solid transparent");
  });
});

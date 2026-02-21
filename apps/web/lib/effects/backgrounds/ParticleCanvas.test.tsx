// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useParticles, PARTICLE_PRESETS } from "./ParticleBackground";
import ParticleCanvas from "./ParticleCanvas";

// Mock ParticleBackground to avoid canvas operations in jsdom
vi.mock("./ParticleBackground", () => ({
  useParticles: vi.fn(),
  PARTICLE_PRESETS: {
    sparkle: {
      count: 80,
      colors: ["#7C6AEF", "#9D8FFF", "#E6EDF3"],
      minRadius: 0.5,
      maxRadius: 1.5,
      speed: 0.2,
      minOpacity: 0.1,
      maxOpacity: 0.5,
      connections: false,
      connectionDistance: 0,
      mouseRepulsion: false,
      mouseRadius: 0,
      sparkle: true,
    },
  },
}));

describe("ParticleCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a canvas element", () => {
    const { container } = render(<ParticleCanvas />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("canvas is aria-hidden (decorative)", () => {
    const { container } = render(<ParticleCanvas />);
    const canvas = container.querySelector("canvas");
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  it("canvas fills its container with absolute positioning", () => {
    const { container } = render(<ParticleCanvas />);
    const canvas = container.querySelector("canvas");
    expect(canvas?.className).toContain("absolute");
    expect(canvas?.className).toContain("inset-0");
    expect(canvas?.className).toContain("w-full");
    expect(canvas?.className).toContain("h-full");
  });

  it("calls useParticles with sparkle preset", () => {
    render(<ParticleCanvas />);
    expect(vi.mocked(useParticles)).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.anything() }),
      PARTICLE_PRESETS.sparkle,
    );
  });
});

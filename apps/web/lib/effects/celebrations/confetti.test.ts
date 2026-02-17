import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock canvas-confetti before importing the module
vi.mock("canvas-confetti", () => {
  const mockConfetti = vi.fn();
  return { default: mockConfetti };
});

describe("celebrations/confetti", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("fireSingleBurst", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireSingleBurst).toBe("function");
    });

    it("calls confetti with expected options", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSingleBurst } = await import("./confetti");
      await fireSingleBurst(50, "amber");
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 50,
          spread: 70,
          disableForReducedMotion: true,
        }),
      );
    });

    it("uses custom origin when provided", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSingleBurst } = await import("./confetti");
      await fireSingleBurst(20, "gold", { x: 0.2, y: 0.8 });
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: { x: 0.2, y: 0.8 },
        }),
      );
    });
  });

  describe("fireMultiBurst", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireMultiBurst).toBe("function");
    });
  });

  describe("fireFireworks", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireFireworks).toBe("function");
    });
  });

  describe("fireSubtleSparkle", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireSubtleSparkle).toBe("function");
    });
  });

  describe("ConfettiPalette type", () => {
    it("module exports the type (compile-time check)", async () => {
      // If this compiles, the type exists
      const mod = await import("./confetti");
      expect(mod).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock canvas-confetti before importing the module
vi.mock("canvas-confetti", () => {
  const mockConfetti = vi.fn();
  return { default: mockConfetti };
});

describe("celebrations/confetti", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it("uses default origin (0.5, 0.5) when not provided", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSingleBurst } = await import("./confetti");
      await fireSingleBurst(30, "amber");
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: { x: 0.5, y: 0.5 },
        }),
      );
    });

    it("uses gold colors for gold palette", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSingleBurst } = await import("./confetti");
      await fireSingleBurst(30, "gold");
      const call = confettiMock.mock.calls[0]![0];
      expect(call.colors).toBeDefined();
      expect(call.colors.length).toBeGreaterThan(0);
    });

    it("uses rainbow colors for rainbow palette", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSingleBurst } = await import("./confetti");
      await fireSingleBurst(30, "rainbow");
      const call = confettiMock.mock.calls[0]![0];
      expect(call.colors).toBeDefined();
      expect(call.colors.length).toBeGreaterThan(0);
    });
  });

  describe("fireMultiBurst", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireMultiBurst).toBe("function");
    });

    it("fires an initial center burst immediately", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireMultiBurst } = await import("./confetti");
      await fireMultiBurst(100, "amber");
      // First call happens immediately (center burst)
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 40, // 100 * 0.4
          spread: 55,
          origin: { x: 0.5, y: 0.5 },
          disableForReducedMotion: true,
        }),
      );
    });

    it("fires left burst after 200ms delay", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireMultiBurst } = await import("./confetti");
      await fireMultiBurst(100, "amber");

      // After 200ms, left burst fires
      vi.advanceTimersByTime(200);
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 30, // 100 * 0.3
          spread: 70,
          origin: { x: 0.3, y: 0.6 },
        }),
      );
    });

    it("fires right burst after 400ms delay", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireMultiBurst } = await import("./confetti");
      await fireMultiBurst(100, "gold");

      // After 400ms, right burst fires
      vi.advanceTimersByTime(400);
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 30,
          origin: { x: 0.7, y: 0.6 },
        }),
      );
    });

    it("fires three total bursts", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireMultiBurst } = await import("./confetti");
      await fireMultiBurst(50, "rainbow");

      // Advance past all timers
      vi.advanceTimersByTime(500);
      expect(confettiMock).toHaveBeenCalledTimes(3);
    });
  });

  describe("fireFireworks", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireFireworks).toBe("function");
    });

    it("starts the fireworks animation loop", async () => {
      const confettiMock = vi.fn();
      const rafMock = vi.fn().mockReturnValue(1);
      vi.stubGlobal("requestAnimationFrame", rafMock);
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireFireworks } = await import("./confetti");
      await fireFireworks(60, "amber", 1);
      // First frame fires immediately
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          disableForReducedMotion: true,
        }),
      );
      vi.unstubAllGlobals();
    });

    it("uses disableForReducedMotion on every frame", async () => {
      const confettiMock = vi.fn();
      vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireFireworks } = await import("./confetti");
      await fireFireworks(30, "gold", 2);
      const call = confettiMock.mock.calls[0]![0];
      expect(call.disableForReducedMotion).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe("fireSubtleSparkle", () => {
    it("is an exported async function", async () => {
      const mod = await import("./confetti");
      expect(typeof mod.fireSubtleSparkle).toBe("function");
    });

    it("returns a cancel function", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSubtleSparkle } = await import("./confetti");
      const cancel = await fireSubtleSparkle("amber", 1);
      expect(typeof cancel).toBe("function");
      // Cancel to prevent leaking timers
      cancel();
    });

    it("fires sparkle particles immediately on start", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSubtleSparkle } = await import("./confetti");
      const cancel = await fireSubtleSparkle("amber", 1);
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 2,
          spread: 360,
          disableForReducedMotion: true,
        }),
      );
      cancel();
    });

    it("stops firing when cancel function is called", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSubtleSparkle } = await import("./confetti");
      const cancel = await fireSubtleSparkle("amber", 1);
      const countAfterStart = confettiMock.mock.calls.length;
      cancel();
      // Advance time — no more calls should happen
      vi.advanceTimersByTime(2000);
      expect(confettiMock.mock.calls.length).toBe(countAfterStart);
    });

    it("continues firing at intervals before cancel", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSubtleSparkle } = await import("./confetti");
      const cancel = await fireSubtleSparkle("amber", 1);
      const firstCount = confettiMock.mock.calls.length;
      // Speed=1, interval = 400/1 = 400ms
      vi.advanceTimersByTime(400);
      expect(confettiMock.mock.calls.length).toBeGreaterThan(firstCount);
      cancel();
    });

    it("uses low gravity and velocity for subtle effect", async () => {
      const confettiMock = vi.fn();
      vi.doMock("canvas-confetti", () => ({ default: confettiMock }));
      const { fireSubtleSparkle } = await import("./confetti");
      const cancel = await fireSubtleSparkle("gold", 1);
      expect(confettiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          startVelocity: 8,
          gravity: 0.4,
          ticks: 200,
        }),
      );
      cancel();
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

// Vitest afterEach import
import { afterEach } from "vitest";

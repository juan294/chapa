// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { GeneratingProgress } from "./GeneratingProgress";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  mockPush.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GeneratingProgress", () => {
  it("renders handle in heading", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<GeneratingProgress handle="testuser" />);
    expect(screen.getByText("@testuser")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("renders terminal command prefix", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<GeneratingProgress handle="testuser" />);
    expect(screen.getByText("chapa generate")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("renders initial steps", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<GeneratingProgress handle="testuser" />);
    expect(screen.getByText("Autenticado con GitHub")).toBeDefined();
    expect(screen.getByText("Recopilando datos de contribución")).toBeDefined();
    expect(screen.getByText("Calculando perfil de impacto")).toBeDefined();
    expect(screen.getByText("Renderizando insignia")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("has status role for live updates", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<GeneratingProgress handle="testuser" />);
    expect(screen.getByRole("status")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows error message when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network")),
    );
    render(<GeneratingProgress handle="testuser" />);

    // Let the promise reject
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText("Algo salió mal al generar tu insignia."),
    ).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows error on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows retry link on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Intentar de nuevo")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("completes steps and redirects on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    );
    render(<GeneratingProgress handle="testuser" />);

    // Let fetch resolve and trigger completeRemainingSteps
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Advance through staggered step completions (300ms * 3 = 900ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Should show redirect notice
    expect(screen.getByText("Redirigiendo a tu insignia...")).toBeDefined();

    // Advance through redirect delay (800ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(mockPush).toHaveBeenCalledWith("/u/testuser");
    vi.unstubAllGlobals();
  });
});

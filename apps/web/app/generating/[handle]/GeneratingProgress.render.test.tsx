// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { GeneratingProgress } from "./GeneratingProgress";
import { LanguageContext, type LanguageContextValue } from "@/lib/i18n/provider";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";
import { resolveTranslation } from "@/lib/i18n/resolve";
import type { Locale, Translations } from "@/lib/i18n";

const mockPush = vi.fn();

function languageValue(locale: Locale, dictionary: Translations): LanguageContextValue {
  return {
    locale,
    setLocale: async () => {},
    t: (key) => resolveTranslation(key, dictionary) as ReturnType<LanguageContextValue["t"]>,
  };
}

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
    // English dict (useTranslation falls back to English without LanguageProvider)
    expect(screen.getByText("Checking GitHub session")).toBeDefined();
    expect(screen.getByText("Collecting contribution data")).toBeDefined();
    expect(screen.getByText("Computing impact profile")).toBeDefined();
    expect(screen.getByText("Rendering badge")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows the GitHub session check as active until the API confirms it", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<GeneratingProgress handle="testuser" />);

    expect(container.querySelector('[data-step="0"]')?.getAttribute("data-status")).toBe("active");
    expect(container.querySelector('[data-step="1"]')?.getAttribute("data-status")).toBe("pending");
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
    // English: generation.error = 'Something went wrong generating your badge.'
    expect(
      screen.getByText("Something went wrong generating your badge."),
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
    expect(
      document.querySelector('[data-step="0"]')?.getAttribute("data-status"),
    ).toBe("error");
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

    // English: generation.retry = 'Try again'
    expect(screen.getByText("Try again")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("keeps the active locale in the retry deep link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(
      <LanguageContext.Provider value={languageValue("en", en)}>
        <GeneratingProgress handle="testuser" />
      </LanguageContext.Provider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Try again").closest("a")?.getAttribute("href")).toBe(
      "/generating/testuser?lang=en",
    );
    vi.unstubAllGlobals();
  });

  it("updates an existing error alert when the active locale changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { rerender } = render(
      <LanguageContext.Provider value={languageValue("es", es)}>
        <GeneratingProgress handle="testuser" />
      </LanguageContext.Provider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Algo salió mal al generar tu Chapa.")).toBeDefined();

    rerender(
      <LanguageContext.Provider value={languageValue("en", en)}>
        <GeneratingProgress handle="testuser" />
      </LanguageContext.Provider>,
    );
    expect(screen.getByText("Something went wrong generating your badge.")).toBeDefined();
    expect(screen.queryByText("Algo salió mal al generar tu Chapa.")).toBeNull();
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

    expect(
      document.querySelector('[data-step="0"]')?.getAttribute("data-status"),
    ).toBe("done");
    expect(
      document.querySelector('[data-step="1"]')?.getAttribute("data-status"),
    ).toBe("active");

    // Advance through staggered step completions (300ms * 3 = 900ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // English: generation.redirect = 'Redirecting to your badge...'
    expect(screen.getByText("Redirecting to your badge...")).toBeDefined();

    // Advance through redirect delay (800ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(mockPush).toHaveBeenCalledWith("/u/testuser");
    vi.unstubAllGlobals();
  });

  it("activates each generation step before marking it done", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.querySelector('[data-step="1"]')?.getAttribute("data-status")).toBe("active");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector('[data-step="1"]')?.getAttribute("data-status")).toBe("done");
    expect(document.querySelector('[data-step="2"]')?.getAttribute("data-status")).toBe("active");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(document.querySelector('[data-step="2"]')?.getAttribute("data-status")).toBe("done");
    expect(document.querySelector('[data-step="3"]')?.getAttribute("data-status")).toBe("active");
    vi.unstubAllGlobals();
  });
});

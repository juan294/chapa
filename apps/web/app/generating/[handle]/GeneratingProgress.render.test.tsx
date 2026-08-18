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

  it("surfaces an error state instead of hanging forever when the request never settles (#1108)", async () => {
    // A fetch that never resolves and never rejects — simulates a stalled
    // network request. Without a timeout, hasError/catch would never fire.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<GeneratingProgress handle="testuser" />);

    // Still pinned on step 0 well before the timeout ceiling.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByRole("alert")).toBeNull();

    // Advance past the ~45s timeout ceiling.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      document.querySelector('[data-step="0"]')?.getAttribute("data-status"),
    ).toBe("error");
    vi.unstubAllGlobals();
  });

  it("shows try-later copy on a 429 rate-limit response, keeping the retry link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText(
        "You're generating badges too quickly. Please wait a moment and try again.",
      ),
    ).toBeDefined();
    // Retrying later is still a valid action for a rate limit.
    expect(screen.getByText("Try again")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows a sign-in-again link on 401 instead of a dead same-URL retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeDefined();
    expect(
      screen.getByText("Your session has expired. Please sign in again."),
    ).toBeDefined();

    const link = screen.getByText("Sign in again").closest("a");
    expect(link?.getAttribute("href")).toBe(
      "/api/auth/login?redirect=%2Fgenerating%2Ftestuser",
    );

    // The old same-URL retry (which cannot re-authenticate) must be gone.
    expect(screen.queryByText("Try again")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("keeps the generic error message on a 5xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    render(<GeneratingProgress handle="testuser" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(
      screen.getByText("Something went wrong generating your badge."),
    ).toBeDefined();
    expect(screen.getByText("Try again")).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("shows reassurance copy after ~5s without re-announcing it on every tick", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<GeneratingProgress handle="testuser" />);

    const statusRegion = container.querySelector('[role="status"]');
    expect(statusRegion).not.toBeNull();
    expect(screen.queryByText(/Still working/)).toBeNull();

    const contentBeforeAt5s = statusRegion?.textContent;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    const notice = screen.getByText(/Still working/);
    expect(notice).toBeDefined();
    // The reassurance copy lives outside the aria-live status region so it
    // doesn't get announced on every re-render/tick.
    expect(statusRegion?.contains(notice)).toBe(false);
    expect(statusRegion?.textContent).toBe(contentBeforeAt5s);

    const contentAfter5s = statusRegion?.textContent;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    // Live region content must be unchanged by further ticks of the notice.
    expect(statusRegion?.textContent).toBe(contentAfter5s);
    vi.unstubAllGlobals();
  });

  it("cancels staggered step timers on unmount so they can't later fire against a stale closure (#1074)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const { unmount } = render(<GeneratingProgress handle="testuser" />);

    // Let fetch resolve and completeRemainingSteps schedule its staggered
    // per-step timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();

    // Every timer the component owns — including the staggered step timers
    // scheduled by completeRemainingSteps — must be cancelled on unmount.
    // None should be left pending to fire later against a stale closure.
    expect(vi.getTimerCount()).toBe(0);
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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MIN_CHALLENGE_REASON_LENGTH } from "@/lib/challenge/validation";
import { ChallengeForm } from "./ChallengeForm";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
const VALID_REASON = "My delivery score seems wrong because my PRs are not counted.";

function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
}

function submitChallenge(reason = VALID_REASON) {
  openForm();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChallengeForm", () => {
  it("shows the CTA button initially, not the form", () => {
    render(<ChallengeForm handle="octocat" />);

    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("reveals the form when CTA button is clicked", () => {
    render(<ChallengeForm handle="octocat" />);

    openForm();

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.cancel" })).toBeTruthy();
  });

  it("shows validation error for reason shorter than 20 chars", () => {
    render(<ChallengeForm handle="octocat" />);

    openForm();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "x".repeat(MIN_CHALLENGE_REASON_LENGTH - 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("scoreExplanation.challenge.validationMinLength")).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("cancel button returns to CTA state", () => {
    render(<ChallengeForm handle="octocat" />);

    openForm();
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.cancel" }));

    expect(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("disables submit and shows submitting label during loading", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<ChallengeForm handle="octocat" />);

    submitChallenge();

    const submitBtn = screen.getByRole("button", {
      name: "scoreExplanation.challenge.submitting",
    });
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.getAttribute("disabled")).not.toBeNull();
    expect(submitBtn.getAttribute("aria-busy")).toBe("true");
  });

  it("shows success callout after 200 response", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<ChallengeForm handle="octocat" />);

    submitChallenge();

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText("scoreExplanation.challenge.successTitle")).toBeTruthy();
    });
  });

  it("shows tooManyRequests message on 429 response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    render(<ChallengeForm handle="octocat" />);

    submitChallenge();

    await waitFor(() => {
      expect(screen.getByText("scoreExplanation.challenge.tooManyRequests")).toBeTruthy();
      expect(screen.getByRole("textbox")).toBeTruthy();
    });
  });

  it("shows generic error message on 500 response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    render(<ChallengeForm handle="octocat" />);

    submitChallenge();

    await waitFor(() => {
      expect(screen.getByText("scoreExplanation.challenge.errorText")).toBeTruthy();
    });
  });

  it("sends fetch to /api/challenge with handle and reason", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    render(<ChallengeForm handle="octocat" />);

    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.ctaButton" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My delivery score seems wrong because my PRs are not counted." },
    });
    fireEvent.click(screen.getByRole("button", { name: "scoreExplanation.challenge.submit" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, opts] = firstCall!;
    expect(url).toBe("/api/challenge");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      handle: "octocat",
      reason: VALID_REASON,
    });
  });
});

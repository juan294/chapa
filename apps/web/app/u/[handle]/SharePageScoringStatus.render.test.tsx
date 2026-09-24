// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { mockResolveBadgeConfigSnapshot } = vi.hoisted(() => ({
  mockResolveBadgeConfigSnapshot: vi.fn(),
}));
vi.mock("@/lib/render/badge-config", () => ({
  resolveBadgeConfigSnapshot: (...args: unknown[]) => mockResolveBadgeConfigSnapshot(...args),
}));
// BadgeToolbar is unrelated to this component's own behavior (it needs a
// mounted app router) — stubbed the same way share-page.render.test.tsx does.
vi.mock("@/components/BadgeToolbar", () => ({
  BadgeToolbar: () => null,
}));

import { SharePageScoringStatus } from "./SharePageScoringStatus";
import type { NonReadyScoringStatus } from "@/lib/render/badge-state";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockResolveBadgeConfigSnapshot.mockResolvedValue({ config: { colorPalette: "ice" }, revision: 1, cacheable: true });
});

const COLLECTING: NonReadyScoringStatus = { kind: "collecting", percent: 55, sources: [], hasPriorReceipt: false };
const ACTION_NEEDED: NonReadyScoringStatus = {
  kind: "action_needed",
  hasPriorReceipt: false,
  sources: [{ provider: "gitlab", state: "failed", percent: 0, reason: "reconnect" }],
};
const UNREGISTERED: NonReadyScoringStatus = { kind: "unregistered" };

describe("SharePageScoringStatus", () => {
  it("names the status badge like the ready badge, in each locale, with the state as its description", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "en", status: UNREGISTERED, badgeState: "unregistered", isOwner: false }),
    );
    const badge = screen.getByRole("img", { name: "Chapa badge for octocat" });
    expect(badge.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(badge.getAttribute("aria-describedby")!)?.textContent).toBe(
      "This person hasn’t set up a Chapa badge yet.",
    );
    cleanup();
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "es", status: COLLECTING, badgeState: "collecting", isOwner: false }),
    );
    expect(screen.getByRole("img", { name: "Chapa de octocat" })).toBeDefined();
  });

  it("renders the collecting badge with data-chapa-state and a visitor sentence", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "en", status: COLLECTING, badgeState: "collecting", isOwner: false }),
    );
    expect(document.querySelector('[data-chapa-state="collecting"]')).not.toBeNull();
    expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
      "This profile's score is still being calculated.",
    );
    // The visitor never sees the owner's per-provider panel.
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("renders the action_needed visitor sentence", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "en", status: ACTION_NEEDED, badgeState: "action_needed", isOwner: false }),
    );
    expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
      "Scoring is paused until the owner takes action.",
    );
  });

  it("renders the unregistered visitor sentence", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "en", status: UNREGISTERED, badgeState: "unregistered", isOwner: false }),
    );
    expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
      "This person hasn’t set up a Chapa badge yet.",
    );
  });

  it("shows the owner the full ScoringStatusPanel instead of the one-sentence summary", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "en", status: ACTION_NEEDED, badgeState: "action_needed", isOwner: true }),
    );
    expect(screen.queryByTestId("share-status-visitor-sentence")).toBeNull();
    // ScoringStatusPanel renders the per-provider reconnect link, given here
    // via `initialStatus` (no fetch — the page already resolved this status).
    expect(screen.getByText("Reconnect GitLab")).toBeDefined();
  });

  it("renders in Spanish when requested", async () => {
    render(
      await SharePageScoringStatus({ handle: "octocat", locale: "es", status: COLLECTING, badgeState: "collecting", isOwner: false }),
    );
    expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
      "La puntuación de este perfil todavía se está calculando.",
    );
  });

  // #1335 phase 4 fix — `status: null` is the "authority read failed"
  // case: there is no real ScoringStatus to show a per-provider panel for,
  // so both owner and visitor see the same one-sentence message.
  describe("unavailable (status: null — authority read failed)", () => {
    it("renders data-chapa-state=unavailable and the same sentence for a visitor", async () => {
      render(
        await SharePageScoringStatus({ handle: "octocat", locale: "en", status: null, badgeState: "unavailable", isOwner: false }),
      );
      expect(document.querySelector('[data-chapa-state="unavailable"]')).not.toBeNull();
      expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
        "Scoring status is temporarily unavailable. Try again shortly.",
      );
    });

    it("shows the SAME one-sentence message to the owner (no ScoringStatusPanel — no real status to detail)", async () => {
      render(
        await SharePageScoringStatus({ handle: "octocat", locale: "en", status: null, badgeState: "unavailable", isOwner: true }),
      );
      expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
        "Scoring status is temporarily unavailable. Try again shortly.",
      );
      expect(screen.queryByText("Scoring status")).toBeNull();
    });

    it("renders in Spanish when requested", async () => {
      render(
        await SharePageScoringStatus({ handle: "octocat", locale: "es", status: null, badgeState: "unavailable", isOwner: false }),
      );
      expect(screen.getByTestId("share-status-visitor-sentence").textContent).toBe(
        "El estado de la puntuación no está disponible temporalmente. Vuelve a intentarlo en breve.",
      );
    });
  });
});

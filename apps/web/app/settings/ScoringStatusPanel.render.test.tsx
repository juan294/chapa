// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { ScoringStatusPanel } from "./ScoringStatusPanel";
import type { ScoringStatus } from "@/lib/collection/scoring-status";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const COLLECTING: ScoringStatus = {
  kind: "collecting",
  percent: 42,
  hasPriorReceipt: false,
  sources: [
    { provider: "github", state: "running", percent: 60 },
    { provider: "bitbucket", state: "waiting_rate_limit", percent: 10, resumesAt: "2026-09-23T14:30:00.000Z" },
  ],
};

const DISCOVERING: ScoringStatus = {
  kind: "collecting",
  percent: null,
  hasPriorReceipt: false,
  sources: [{ provider: "github", state: "running", percent: null }],
};

const ACTION_NEEDED: ScoringStatus = {
  kind: "action_needed",
  hasPriorReceipt: false,
  sources: [
    { provider: "gitlab", state: "failed", percent: 0, reason: "reconnect" },
    { provider: "codeberg", state: "failed", percent: 0, reason: "failed" },
  ],
};

describe("ScoringStatusPanel", () => {
  describe("with a server-resolved initialStatus (no fetch)", () => {
    it("renders a ready status without calling fetch", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "ready", receiptDate: "2026-09-23", updating: false }} />);
      expect(screen.getByTestId("scoring-status-ready")).toBeDefined();
      expect(screen.getByText("Your score is up to date.")).toBeDefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("shows the updating message for a ready-but-updating status", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "ready", receiptDate: "2026-09-23", updating: true }} />);
      expect(screen.getByText("Showing your score from 2026-09-23 while we collect newer activity.")).toBeDefined();
    });

    it("dates a prior score while newer completed evidence waits for publication", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "ready", receiptDate: "2026-09-22", updating: true, finalizing: true }} />);
      expect(screen.getByText("Showing your score from 2026-09-22 while we finish the newer score.")).toBeDefined();
      expect(screen.queryByText(/up to date/)).toBeNull();
    });

    it("renders the collecting percent and per-provider rows", () => {
      render(<ScoringStatusPanel initialStatus={COLLECTING} />);
      expect(screen.getByText("Collecting evidence — 42% complete")).toBeDefined();
      expect(screen.getByTestId("scoring-status-source-github").textContent).toContain("Collecting");
      const localTime = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
        .format(new Date("2026-09-23T14:30:00.000Z"));
      expect(screen.getByTestId("scoring-status-source-bitbucket").textContent).toContain(localTime);
    });

    // #1342 -- while any job can still add operations, no percentage shows.
    it("shows the discovering copy and no percentage when percent is null", () => {
      render(<ScoringStatusPanel initialStatus={DISCOVERING} />);
      expect(screen.getByText("Discovering your activity. A percentage appears once the total is known.")).toBeDefined();
      expect(screen.queryByText(/\d+% complete/)).toBeNull();
    });

    it("renders resume times in UTC on the server so hydration matches", () => {
      const html = renderToString(<ScoringStatusPanel initialStatus={COLLECTING} />);
      expect(html).toContain("14:30 UTC");
    });

    it("renders action_needed rows with a Reconnect link and a Retry button", () => {
      render(<ScoringStatusPanel initialStatus={ACTION_NEEDED} />);
      expect(screen.getByText("Scoring paused: action needed")).toBeDefined();

      const gitlabRow = screen.getByTestId("scoring-status-source-gitlab");
      const reconnectLink = gitlabRow.querySelector("a");
      expect(reconnectLink?.getAttribute("href")).toBe("/api/auth/gitlab/connect?returnTo=%2Fsettings");
      expect(reconnectLink?.textContent).toBe("Reconnect GitLab");

      const codebergRow = screen.getByTestId("scoring-status-source-codeberg");
      expect(codebergRow.querySelector("button")?.textContent).toBe("Retry");
    });

    it("offers Retry and support for a terminal storage failure and dates the prior score", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "action_needed", hasPriorReceipt: true, priorReceiptDate: "2026-09-22", sources: [
        { provider: "github", state: "failed", percent: null, reason: "storage" },
      ] }} />);
      expect(screen.getByTestId("scoring-status-prior-receipt").textContent).toContain("2026-09-22");
      const row = screen.getByTestId("scoring-status-source-github");
      expect(row.textContent).toContain("We could not save this score.");
      expect(row.querySelector("button")?.textContent).toBe("Retry");
      expect(row.querySelector('a[href="mailto:support@chapa.thecreativetoken.com"]')?.textContent).toBe("Contact support");
    });

    it("directs terminal capacity failures to support without promising a Retry", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "action_needed", hasPriorReceipt: false, sources: [
        { provider: "github", state: "failed", percent: null, reason: "capacity" },
      ] }} />);
      const row = screen.getByTestId("scoring-status-source-github");
      expect(row.textContent).toContain("reached the current capacity limit");
      expect(row.querySelector("button")).toBeNull();
      expect(row.querySelector("a")?.textContent).toBe("Contact support");
    });

    it("shows finalizing instead of 99% after provider collection is complete", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "collecting", percent: null, finalizing: true, hasPriorReceipt: false, sources: [] }} />);
      expect(screen.getByText("Evidence collected. Finishing your score…")).toBeDefined();
      expect(screen.queryByText(/99%/)).toBeNull();
    });

    it("shows the unregistered fallback text and never fetches", () => {
      render(<ScoringStatusPanel initialStatus={{ kind: "unregistered" }} />);
      expect(screen.getByText("You haven’t started scoring yet.")).toBeDefined();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("shows the unavailable message when the server already knows the read failed (null)", () => {
      render(<ScoringStatusPanel initialStatus={null} />);
      expect(screen.getByText("You haven’t started scoring yet.")).toBeDefined();
    });
  });

  describe("without initialStatus — fetches GET /api/scoring/status", () => {
    it("shows a loading state, then the fetched status", async () => {
      let resolveFetch!: (value: unknown) => void;
      vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }) as never);
      render(<ScoringStatusPanel />);
      expect(screen.getByText("Loading scoring status…")).toBeDefined();

      await act(async () => {
        resolveFetch({ ok: true, json: async () => ({ scoringStatus: COLLECTING }) });
      });

      await waitFor(() => expect(screen.getByText("Collecting evidence — 42% complete")).toBeDefined());
      expect(fetch).toHaveBeenCalledWith("/api/scoring/status");
    });

    it("shows an error state when the fetch fails", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("network"));
      render(<ScoringStatusPanel />);
      await waitFor(() => expect(screen.getByText("Couldn’t load scoring status.")).toBeDefined());
    });

    it("shows an error state on a non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
      render(<ScoringStatusPanel />);
      await waitFor(() => expect(screen.getByText("Couldn’t load scoring status.")).toBeDefined());
    });
  });

  describe("retry", () => {
    it("POSTs a retry action for the given provider and refetches on success", async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true } as Response) // POST retry
        .mockResolvedValueOnce({ ok: true, json: async () => ({ scoringStatus: { kind: "ready", receiptDate: "2026-09-23", updating: false } }) } as Response); // refetch

      render(<ScoringStatusPanel initialStatus={ACTION_NEEDED} />);
      const codebergRow = screen.getByTestId("scoring-status-source-codeberg");
      const retryButton = codebergRow.querySelector("button")!;

      await act(async () => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => expect(fetch).toHaveBeenNthCalledWith(1, "/api/scoring/status", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "retry", provider: "codeberg" }),
      })));
      await waitFor(() => expect(screen.getByTestId("scoring-status-ready")).toBeDefined());
    });

    it("shows a retry error without losing the rest of the panel", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
      render(<ScoringStatusPanel initialStatus={ACTION_NEEDED} />);
      const codebergRow = screen.getByTestId("scoring-status-source-codeberg");
      const retryButton = codebergRow.querySelector("button")!;

      await act(async () => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => expect(screen.getByText("Retry failed. Try again.")).toBeDefined());
      // The panel itself is still showing the same action_needed state.
      expect(screen.getByText("Scoring paused: action needed")).toBeDefined();
    });
  });
});

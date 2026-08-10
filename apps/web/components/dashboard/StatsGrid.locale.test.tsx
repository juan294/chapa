// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StatsData } from "@chapa/shared";
import { es } from "@/lib/i18n/dictionaries/es";
import { resolveTranslation } from "@/lib/i18n/resolve";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "es",
    t: (key: string) => resolveTranslation(key, es),
  }),
}));

vi.mock("@/components/InfoTooltip", () => ({
  InfoTooltip: ({ id, content }: { id: string; content: string }) => (
    <span data-testid={id}>{content}</span>
  ),
}));

vi.mock("./DeltaIndicator", () => ({
  DeltaIndicator: () => null,
}));

import { StatsGrid } from "./StatsGrid";

afterEach(cleanup);

const stats: StatsData = {
  handle: "testuser",
  commitsTotal: 320,
  activeDays: 180,
  prsMergedCount: 65,
  prsMergedWeight: 72,
  reviewsSubmittedCount: 30,
  issuesClosedCount: 20,
  linesAdded: 40000,
  linesDeleted: 15000,
  reposContributed: 6,
  topRepoShare: 0.4,
  maxCommitsIn10Min: 2,
  totalStars: 500,
  totalForks: 120,
  totalWatchers: 45,
  heatmapData: [],
  fetchedAt: "2026-08-10T00:00:00Z",
};

describe("StatsGrid locale", () => {
  it("renders Spanish labels and tooltip content in the live dashboard grid", () => {
    render(<StatsGrid stats={stats} diff={null} />);

    expect(screen.getByText("Días activos")).toBeDefined();
    expect(screen.getByText("PRs fusionadas")).toBeDefined();
    expect(screen.getByText("Repositorios")).toBeDefined();
    expect(screen.getByTestId("stat-active-days").textContent).toContain(
      "últimos 365 días",
    );
    expect(screen.queryByText("Active Days")).toBeNull();
    expect(screen.queryByText("PRs Merged")).toBeNull();
  });
});

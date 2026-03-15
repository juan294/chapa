// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CampaignsDashboard } from "./campaigns-dashboard";

afterEach(cleanup);

const mockCampaigns = [
  {
    id: "c-1",
    name: "March Update",
    status: "draft",
    subject: "What's new",
    headline: "New features",
    bodyText: "Check it out",
    features: [],
    ctaText: "See What's New",
    ctaUrl: "https://example.com",
    previewText: null,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    createdAt: "2026-03-15T00:00:00Z",
    startedAt: null,
    completedAt: null,
  },
  {
    id: "c-2",
    name: "April Update",
    status: "sending",
    subject: "More updates",
    headline: "Even more features",
    bodyText: "Lots of stuff",
    features: [{ text: "Feature A" }],
    ctaText: "Check It Out",
    ctaUrl: "https://example.com",
    previewText: null,
    totalRecipients: 100,
    sentCount: 50,
    failedCount: 2,
    createdAt: "2026-04-01T00:00:00Z",
    startedAt: "2026-04-01T08:00:00Z",
    completedAt: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ campaigns: mockCampaigns }),
    text: () => Promise.resolve("<html>preview</html>"),
  });
});

describe("CampaignsDashboard", () => {
  it("renders campaign list on mount", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
      expect(screen.getByText("April Update")).toBeTruthy();
    });
  });

  it("shows empty state when no campaigns", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ campaigns: [] }),
    });

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });
  });

  it("New Campaign button switches to create view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));
    expect(screen.getByText("Campaign Name")).toBeTruthy();
    expect(screen.getByText("Create Draft")).toBeTruthy();
  });

  it("campaign row click opens detail view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
      expect(screen.getByText("Send Campaign")).toBeTruthy();
    });
  });

  it("detail view shows send progress for sending campaigns", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("April Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("April Update"));
    await waitFor(() => {
      expect(screen.getByText(/50 \/ 100 sent/)).toBeTruthy();
      expect(screen.getByText(/2 failed/)).toBeTruthy();
    });
  });

  it("status badges show correct text", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("draft")).toBeTruthy();
      expect(screen.getByText("sending")).toBeTruthy();
    });
  });
});

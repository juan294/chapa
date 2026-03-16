// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { Campaign } from "@/lib/db/campaigns";
import { CampaignsDashboard } from "./campaigns-dashboard";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockCampaigns: Campaign[] = [
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

const sentCampaign: Campaign = {
  id: "c-3",
  name: "Sent Campaign",
  status: "sent",
  subject: "Old news",
  headline: "Already sent",
  bodyText: "Done",
  features: [],
  ctaText: "See It",
  ctaUrl: "https://example.com",
  previewText: null,
  totalRecipients: 50,
  sentCount: 48,
  failedCount: 2,
  createdAt: "2026-02-01T00:00:00Z",
  startedAt: "2026-02-01T08:00:00Z",
  completedAt: "2026-02-01T09:00:00Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(campaigns = mockCampaigns) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ campaigns }),
    text: () => Promise.resolve("<html>preview</html>"),
  });
}

function mockFetchError(status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: "Server error" }),
    text: () => Promise.resolve("error"),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchSuccess();
});

// ---------------------------------------------------------------------------
// LIST VIEW
// ---------------------------------------------------------------------------

describe("CampaignsDashboard — list view", () => {
  it("renders campaign list on mount", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
      expect(screen.getByText("April Update")).toBeTruthy();
    });
  });

  it("shows empty state when no campaigns", async () => {
    mockFetchSuccess([]);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });
  });

  it("shows loading state initially", () => {
    // Use a never-resolving promise to keep loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<CampaignsDashboard />);
    expect(screen.getByText("Loading campaigns...")).toBeTruthy();
  });

  it("shows error state when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  it("shows error state on non-OK response", async () => {
    mockFetchError(500);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("HTTP 500")).toBeTruthy();
    });
  });

  it("status badges show correct text", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("draft")).toBeTruthy();
      expect(screen.getByText("sending")).toBeTruthy();
    });
  });

  it("dismiss button clears error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Dismiss"));
    expect(screen.queryByText("Network error")).toBeNull();
  });

  it("shows New Campaign button in list view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });
  });

  it("displays campaign table with correct columns", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Name")).toBeTruthy();
      expect(screen.getByText("Status")).toBeTruthy();
      expect(screen.getByText("Recipients")).toBeTruthy();
      expect(screen.getByText("Sent")).toBeTruthy();
      expect(screen.getByText("Created")).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// CREATE VIEW
// ---------------------------------------------------------------------------

describe("CampaignsDashboard — create view", () => {
  it("New Campaign button switches to create view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));
    expect(screen.getByText("Campaign Name")).toBeTruthy();
    expect(screen.getByText("Email Subject")).toBeTruthy();
    expect(screen.getByText("Headline")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("CTA Button Text")).toBeTruthy();
    expect(screen.getByText("CTA URL")).toBeTruthy();
    expect(screen.getByText("Create Draft")).toBeTruthy();
  });

  it("Cancel button returns to list view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));
    expect(screen.getByText("Create Draft")).toBeTruthy();

    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });
  });

  it("submits create form and returns to list", async () => {
    const fetchMock = vi.fn()
      // Initial campaigns fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: [] }),
      })
      // Create POST
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "new-id" }),
      })
      // Refresh fetch after create
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: [mockCampaigns[0]] }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));

    // Fill in form fields
    const nameInput = screen.getByPlaceholderText("March 2026 Update");
    fireEvent.change(nameInput, { target: { value: "Test Campaign" } });

    const subjectInput = screen.getByPlaceholderText("What's new in Chapa");
    fireEvent.change(subjectInput, { target: { value: "Subject Line" } });

    const headlineInput = screen.getByPlaceholderText("Your dashboard just got better");
    fireEvent.change(headlineInput, { target: { value: "Headline" } });

    const bodyInput = screen.getByPlaceholderText("Short paragraph about what changed...");
    fireEvent.change(bodyInput, { target: { value: "Body content" } });

    // Submit the form
    fireEvent.click(screen.getByText("Create Draft"));

    await waitFor(() => {
      // Should have called fetch with POST
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/campaigns",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows error when create form submission fails", async () => {
    const fetchMock = vi.fn()
      // Initial campaigns fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: [] }),
      })
      // Create POST fails
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Server validation failed" }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));

    // Fill in required fields to bypass HTML5 validation
    fireEvent.change(screen.getByPlaceholderText("March 2026 Update"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("What's new in Chapa"), { target: { value: "Sub" } });
    fireEvent.change(screen.getByPlaceholderText("Your dashboard just got better"), { target: { value: "Head" } });
    fireEvent.change(screen.getByPlaceholderText("Short paragraph about what changed..."), { target: { value: "Body" } });

    fireEvent.click(screen.getByText("Create Draft"));

    await waitFor(() => {
      expect(screen.getByText("Server validation failed")).toBeTruthy();
    });
  });

  it("adds and removes feature highlights", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));

    // Add a feature
    fireEvent.click(screen.getByText("+ Add feature"));
    const featureInputs = screen.getAllByPlaceholderText("Feature description");
    expect(featureInputs).toHaveLength(1);

    // Type in the feature
    fireEvent.change(featureInputs[0]!, { target: { value: "Great feature" } });

    // Add another feature
    fireEvent.click(screen.getByText("+ Add feature"));
    const allFeatureInputs = screen.getAllByPlaceholderText("Feature description");
    expect(allFeatureInputs).toHaveLength(2);

    // Remove first feature (the × button)
    const removeButtons = screen.getAllByText("×");
    fireEvent.click(removeButtons[0]!);
    const remainingInputs = screen.getAllByPlaceholderText("Feature description");
    expect(remainingInputs).toHaveLength(1);
  });

  it("updates preview text field", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));

    const previewInput = screen.getByPlaceholderText("Shown in inbox preview");
    fireEvent.change(previewInput, { target: { value: "Preview text content" } });
    expect((previewInput as HTMLInputElement).value).toBe("Preview text content");
  });

  it("handles error when create response is not JSON-parseable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve(null),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("New Campaign"));

    // Fill in required fields to bypass HTML5 validation
    fireEvent.change(screen.getByPlaceholderText("March 2026 Update"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("What's new in Chapa"), { target: { value: "Sub" } });
    fireEvent.change(screen.getByPlaceholderText("Your dashboard just got better"), { target: { value: "Head" } });
    fireEvent.change(screen.getByPlaceholderText("Short paragraph about what changed..."), { target: { value: "Body" } });

    fireEvent.click(screen.getByText("Create Draft"));

    await waitFor(() => {
      expect(screen.getByText("HTTP 500")).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// DETAIL VIEW
// ---------------------------------------------------------------------------

describe("CampaignsDashboard — detail view", () => {
  it("campaign row click opens detail view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
      expect(screen.getByText("Send Campaign")).toBeTruthy();
      expect(screen.getByText("Delete")).toBeTruthy();
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

  it("back button returns to list view", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
    });

    // Click back button (← Back to campaigns)
    const backButton = screen.getByText(/Back to campaigns/);
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });
  });

  it("preview email button loads and displays preview", async () => {
    const fetchMock = vi.fn()
      // Initial campaigns fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
        text: () => Promise.resolve(""),
      })
      // Preview fetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html><body>Email Preview Content</body></html>"),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Preview Email"));

    await waitFor(() => {
      expect(screen.getByText("Email Preview")).toBeTruthy();
      const iframe = screen.getByTitle("Campaign email preview");
      expect(iframe).toBeTruthy();
    });
  });

  it("shows error when preview fetch fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Preview Email"));

    await waitFor(() => {
      expect(screen.getByText("HTTP 500")).toBeTruthy();
    });
  });

  it("send campaign button triggers send and shows result", async () => {
    const fetchMock = vi.fn()
      // Initial campaigns fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      // Send POST
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: "All emails sent" }),
      })
      // Refresh campaigns after send
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Send Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Send Campaign"));

    await waitFor(() => {
      expect(screen.getByText("All emails sent")).toBeTruthy();
    });
  });

  it("shows error when send fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Campaign already started" }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Send Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Send Campaign"));

    await waitFor(() => {
      expect(screen.getByText("Campaign already started")).toBeTruthy();
    });
  });

  it("shows error fallback when send error is not JSON-parseable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    fireEvent.click(screen.getByText("Send Campaign"));

    await waitFor(() => {
      expect(screen.getByText("HTTP 502")).toBeTruthy();
    });
  });

  it("delete campaign removes it and returns to list", async () => {
    const fetchMock = vi.fn()
      // Initial campaigns fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      // Delete
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
      // Refresh after delete
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: [mockCampaigns[1]] }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      // Should return to list view
      expect(screen.getByText("New Campaign")).toBeTruthy();
    });

    // Verify DELETE was called
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/campaigns/c-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows error when delete fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Can only delete draft campaigns" }),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Can only delete draft campaigns")).toBeTruthy();
    });
  });

  it("shows error fallback when delete error is not JSON-parseable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error("not json")),
      });
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("HTTP 400")).toBeTruthy();
    });
  });

  it("detail view does not show send/preview/delete for non-draft campaigns", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("April Update")).toBeTruthy();
    });

    // Click on sending campaign
    fireEvent.click(screen.getByText("April Update"));
    await waitFor(() => {
      expect(screen.getByText(/50 \/ 100 sent/)).toBeTruthy();
    });

    // Should not show send/preview/delete buttons for sending campaigns
    expect(screen.queryByText("Send Campaign")).toBeNull();
    expect(screen.queryByText("Preview Email")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("detail view shows campaign metadata", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Subject")).toBeTruthy();
      expect(screen.getByText("What's new")).toBeTruthy();
      expect(screen.getByText("Headline")).toBeTruthy();
      expect(screen.getByText("New features")).toBeTruthy();
      expect(screen.getByText("Created")).toBeTruthy();
    });
  });

  it("detail view shows startedAt and completedAt when present", async () => {
    mockFetchSuccess([sentCampaign]);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Sent Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Sent Campaign"));
    await waitFor(() => {
      expect(screen.getByText("Started")).toBeTruthy();
      expect(screen.getByText("Completed")).toBeTruthy();
    });
  });

  it("detail view shows daily rate limit info for sending campaigns", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("April Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("April Update"));
    await waitFor(() => {
      expect(screen.getByText(/95 emails\/day/)).toBeTruthy();
    });
  });

  it("does not show progress bar for campaigns with zero recipients", async () => {
    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    // March Update is draft with 0 recipients
    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Preview Email")).toBeTruthy();
    });

    // Should not show "0 / 0 sent" progress text
    expect(screen.queryByText(/\d+ \/ \d+ sent/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// StatusBadge edge cases
// ---------------------------------------------------------------------------

describe("CampaignsDashboard — StatusBadge", () => {
  it("renders sent status badge", async () => {
    mockFetchSuccess([sentCampaign]);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("sent")).toBeTruthy();
    });
  });

  it("renders failed status badge", async () => {
    const failedCampaign: Campaign = { ...sentCampaign, id: "c-4", name: "Failed Campaign", status: "failed" };
    mockFetchSuccess([failedCampaign]);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("failed")).toBeTruthy();
    });
  });

  it("renders unknown status with draft fallback styling", async () => {
    const unknownCampaign = { ...sentCampaign, id: "c-5", name: "Unknown Campaign", status: "unknown" as Campaign["status"] };
    mockFetchSuccess([unknownCampaign]);

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("unknown")).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("CampaignsDashboard — edge cases", () => {
  it("handles campaigns response with missing campaigns field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("No campaigns yet")).toBeTruthy();
    });
  });

  it("send button is disabled while sending", async () => {
    // Use a promise that we can control when it resolves
    let resolveSend: (value: unknown) => void;
    const sendPromise = new Promise((resolve) => {
      resolveSend = resolve;
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ campaigns: mockCampaigns }),
      })
      .mockReturnValueOnce(sendPromise);
    global.fetch = fetchMock;

    render(<CampaignsDashboard />);
    await waitFor(() => {
      expect(screen.getByText("March Update")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("March Update"));
    await waitFor(() => {
      expect(screen.getByText("Send Campaign")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Send Campaign"));

    // While the send is in progress, the button should show "Sending..."
    await waitFor(() => {
      expect(screen.getByText("Sending...")).toBeTruthy();
    });

    // The button should be disabled
    const sendButton = screen.getByText("Sending...");
    expect(sendButton.closest("button")?.disabled).toBe(true);

    // Resolve the send
    resolveSend!({
      ok: true,
      json: () => Promise.resolve({ message: "Done" }),
    });
  });
});

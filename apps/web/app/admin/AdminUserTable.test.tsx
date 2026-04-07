// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Module mocks — needed to render the component in JSDOM
// ---------------------------------------------------------------------------

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    onError,
    ...props
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    width: number;
    height: number;
    className?: string;
  }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-testid="avatar-img" onError={onError} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("./AdminSortableHeader", () => ({
  AdminSortableHeader: ({ label }: { label: string }) => <th>{label}</th>,
  AdminHeaderCell: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
}));

// ---------------------------------------------------------------------------
// Source-level static assertions
// ---------------------------------------------------------------------------

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, "AdminUserTable.tsx"),
  "utf-8",
);

import { AdminUserTable } from "./AdminUserTable";
import type { AdminUser, SortField, SortDir } from "./admin-types";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    registeredAt: "2025-01-01T00:00:00Z",
    lastSnapshotDate: "2025-04-01",
    fetchedAt: "2025-04-01T12:00:00Z",
    commitsTotal: 142,
    prsMergedCount: 18,
    reviewsSubmittedCount: 31,
    activeDays: 45,
    reposContributed: 4,
    totalStars: 25,
    archetype: "Builder",
    tier: "Solid",
    adjustedComposite: 72,
    rawScore: 70,
    confidence: 85,
    ...overrides,
  };
}

const defaultTableProps = {
  search: "",
  sortField: "handle" as SortField,
  sortDir: "asc" as SortDir,
  onSort: vi.fn(),
};

// ---------------------------------------------------------------------------
// Static assertions (carried from original test)
// ---------------------------------------------------------------------------

describe("AdminUserTable", () => {
  describe("#518 — aria-label on table", () => {
    it("table element has aria-label 'Registered users'", () => {
      expect(SOURCE).toContain('aria-label="Registered users"');
    });
  });

  describe("#519 — ARIA progressbar on confidence bar", () => {
    it("confidence bar has role='progressbar'", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain('role="progressbar"');
    });

    it("confidence bar has aria-valuenow bound to user.confidence", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuenow={user.confidence}");
    });

    it("confidence bar has aria-valuemin={0}", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuemin={0}");
    });

    it("confidence bar has aria-valuemax={100}", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain("aria-valuemax={100}");
    });

    it("confidence bar has aria-label 'Confidence score'", () => {
      const confidenceStart = SOURCE.indexOf("{/* Confidence */}");
      const confidenceEnd = SOURCE.indexOf("{/* Stats columns */}");
      const section = SOURCE.slice(confidenceStart, confidenceEnd);
      expect(section).toContain('aria-label="Confidence score"');
    });
  });

  // ---------------------------------------------------------------------------
  // Render tests — empty state branches
  // ---------------------------------------------------------------------------

  describe("empty state", () => {
    it("shows 'No users found.' when users=[] and no search", () => {
      render(<AdminUserTable {...defaultTableProps} users={[]} />);
      expect(screen.getByText("No users found.")).toBeDefined();
    });

    it("shows 'No users match your search.' when users=[] and search is non-empty", () => {
      render(<AdminUserTable {...defaultTableProps} users={[]} search="alice" />);
      expect(screen.getByText("No users match your search.")).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Render tests — avatar conditional branches
  // ---------------------------------------------------------------------------

  describe("avatar display", () => {
    it("renders avatar image when avatarUrl is present and no error", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser()]} />);
      const img = screen.getByTestId("avatar-img");
      expect(img.getAttribute("src")).toContain("avatars.githubusercontent.com");
    });

    it("renders initial letter fallback when avatarUrl is null", () => {
      render(
        <AdminUserTable {...defaultTableProps} users={[makeUser({ avatarUrl: null })]} />,
      );
      // No image — fallback div shows first letter of handle
      expect(screen.queryByTestId("avatar-img")).toBeNull();
      expect(screen.getByText("T")).toBeDefined(); // "testuser" → "T"
    });

    it("renders initial letter fallback when image fails to load", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser()]} />);
      const img = screen.getByTestId("avatar-img");

      // Simulate image error — triggers imgErrors state update
      fireEvent.error(img);

      // After error, the fallback initial should appear
      expect(screen.queryByTestId("avatar-img")).toBeNull();
      expect(screen.getByText("T")).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Render tests — developer cell sub-branches
  // ---------------------------------------------------------------------------

  describe("developer cell", () => {
    it("shows displayName when snapshot exists and displayName is set", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser()]} />);
      expect(screen.getByText("Test User")).toBeDefined();
    });

    it("shows 'no data yet' when lastSnapshotDate is null", () => {
      render(
        <AdminUserTable
          {...defaultTableProps}
          users={[makeUser({ lastSnapshotDate: null })]}
        />,
      );
      expect(screen.getByText("no data yet")).toBeDefined();
    });

    it("shows nothing for display name when snapshot exists but displayName is null", () => {
      render(
        <AdminUserTable
          {...defaultTableProps}
          users={[makeUser({ displayName: null })]}
        />,
      );
      // "no data yet" should NOT appear — snapshot exists
      expect(screen.queryByText("no data yet")).toBeNull();
      // displayName is null → no secondary text rendered
      expect(screen.queryByText("Test User")).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Render tests — optional column null branches
  // ---------------------------------------------------------------------------

  describe("optional columns — null fallback (—)", () => {
    it("shows em-dash when archetype is null", () => {
      render(
        <AdminUserTable {...defaultTableProps} users={[makeUser({ archetype: null })]} />,
      );
      // archetype null → renders — (HTML entity &mdash;)
      const cells = document.querySelectorAll("td");
      const archetypeCell = Array.from(cells).find(
        (c) => c.textContent === "—",
      );
      expect(archetypeCell).toBeDefined();
    });

    it("shows archetype name when archetype is set", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser({ archetype: "Polymath" })]} />);
      expect(screen.getByText("Polymath")).toBeDefined();
    });

    it("shows em-dash when tier is null", () => {
      render(
        <AdminUserTable {...defaultTableProps} users={[makeUser({ tier: null })]} />,
      );
      const cells = document.querySelectorAll("td");
      const tierCell = Array.from(cells).find((c) => c.textContent === "—");
      expect(tierCell).toBeDefined();
    });

    it("shows tier label when tier is set", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser({ tier: "Elite" })]} />);
      expect(screen.getByText("Elite")).toBeDefined();
    });

    it("shows em-dash when adjustedComposite is null", () => {
      render(
        <AdminUserTable
          {...defaultTableProps}
          users={[makeUser({ adjustedComposite: null, tier: null })]}
        />,
      );
      const cells = document.querySelectorAll("td");
      const nullCells = Array.from(cells).filter((c) => c.textContent === "—");
      expect(nullCells.length).toBeGreaterThan(0);
    });

    it("shows adjusted composite score when set", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser({ adjustedComposite: 88 })]} />);
      expect(screen.getByText("88")).toBeDefined();
    });

    it("shows confidence bar when confidence is set", () => {
      render(<AdminUserTable {...defaultTableProps} users={[makeUser({ confidence: 75 })]} />);
      const progressbar = screen.getByRole("progressbar");
      expect(progressbar.getAttribute("aria-valuenow")).toBe("75");
    });

    it("shows em-dash when confidence is null", () => {
      render(
        <AdminUserTable {...defaultTableProps} users={[makeUser({ confidence: null })]} />,
      );
      expect(screen.queryByRole("progressbar")).toBeNull();
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdminUserTable } from "./AdminUserTable";
import type { AdminUser, SortField, SortDir } from "./admin-types";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Mock next/image and next/link for jsdom
// ---------------------------------------------------------------------------

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _f, priority: _p, placeholder: _ph, blurDataURL: _b, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    fetchedAt: new Date().toISOString(),
    commitsTotal: 150,
    prsMergedCount: 25,
    reviewsSubmittedCount: 10,
    activeDays: 200,
    reposContributed: 5,
    totalStars: 42,
    archetype: "Builder",
    tier: "High",
    adjustedComposite: 72,
    confidence: 85,
    statsExpired: false,
    ...overrides,
  };
}

const defaultProps = {
  users: [makeUser()],
  search: "",
  sortField: "adjustedComposite" as SortField,
  sortDir: "desc" as SortDir,
  onSort: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminUserTable — render tests", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<AdminUserTable {...defaultProps} />);
      expect(screen.getByRole("table")).toBeDefined();
    });

    it("renders thead and tbody", () => {
      const { container } = render(<AdminUserTable {...defaultProps} />);
      expect(container.querySelector("thead")).not.toBeNull();
      expect(container.querySelector("tbody")).not.toBeNull();
    });

    it("renders column headers", () => {
      render(<AdminUserTable {...defaultProps} />);
      expect(screen.getByText("Developer")).toBeDefined();
      expect(screen.getByText("Score")).toBeDefined();
      expect(screen.getByText("Tier")).toBeDefined();
    });
  });

  describe("user rows", () => {
    it("renders a row for each user", () => {
      const users = [
        makeUser({ handle: "alice" }),
        makeUser({ handle: "bob" }),
        makeUser({ handle: "charlie" }),
      ];
      render(<AdminUserTable {...defaultProps} users={users} />);
      expect(screen.getByText("alice")).toBeDefined();
      expect(screen.getByText("bob")).toBeDefined();
      expect(screen.getByText("charlie")).toBeDefined();
    });

    it("displays the user handle", () => {
      render(<AdminUserTable {...defaultProps} users={[makeUser({ handle: "juan294" })]} />);
      expect(screen.getByText("juan294")).toBeDefined();
    });

    it("displays the display name", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ handle: "j", displayName: "Juan Garcia" })]}
        />,
      );
      expect(screen.getByText("Juan Garcia")).toBeDefined();
    });

    it("renders a link to the user share page", () => {
      render(<AdminUserTable {...defaultProps} users={[makeUser({ handle: "testuser" })]} />);
      const links = screen.getAllByRole("link", { name: /testuser/i });
      const shareLink = links.find((l) => l.getAttribute("href") === "/u/testuser");
      expect(shareLink).toBeDefined();
    });

    it("renders the user avatar image", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ handle: "testuser", avatarUrl: "https://example.com/avatar.png" })]}
        />,
      );
      const img = screen.getByAltText("testuser's avatar");
      expect(img).toBeDefined();
      expect(img.getAttribute("src")).toBe("https://example.com/avatar.png");
    });

    it("shows initial letter fallback when no avatar URL", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ handle: "alice", avatarUrl: null })]}
        />,
      );
      expect(screen.getByText("A")).toBeDefined();
    });

    it("displays the archetype", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ archetype: "Guardian" })]}
        />,
      );
      expect(screen.getByText("Guardian")).toBeDefined();
    });

    it("displays the tier as a badge", () => {
      render(
        <AdminUserTable {...defaultProps} users={[makeUser({ tier: "Elite" })]} />,
      );
      expect(screen.getByText("Elite")).toBeDefined();
    });

    it("displays the adjusted composite score", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ adjustedComposite: 88 })]}
        />,
      );
      expect(screen.getByText("88")).toBeDefined();
    });

    it("displays the confidence value", () => {
      render(
        <AdminUserTable {...defaultProps} users={[makeUser({ confidence: 92 })]} />,
      );
      expect(screen.getByText("92")).toBeDefined();
    });
  });

  describe("empty state", () => {
    it("shows generic empty message when no search and no users", () => {
      render(<AdminUserTable {...defaultProps} users={[]} search="" />);
      expect(screen.getByText("No users found.")).toBeDefined();
    });

    it("shows search-specific message when search is active and no results", () => {
      render(<AdminUserTable {...defaultProps} users={[]} search="xyz" />);
      expect(screen.getByText("No users match your search.")).toBeDefined();
    });
  });

  describe("expired users", () => {
    it("shows 'data expired' label for expired users", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ statsExpired: true })]}
        />,
      );
      expect(screen.getByText("data expired")).toBeDefined();
    });

    it("dims expired user rows with opacity", () => {
      const { container } = render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ statsExpired: true })]}
        />,
      );
      const row = container.querySelector("tbody tr");
      expect(row?.className).toContain("opacity-60");
    });

    it("does not dim non-expired users", () => {
      const { container } = render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ statsExpired: false })]}
        />,
      );
      const row = container.querySelector("tbody tr");
      expect(row?.className).not.toContain("opacity-60");
    });
  });

  describe("badge SVG link", () => {
    it("renders a link to the badge SVG", () => {
      render(
        <AdminUserTable {...defaultProps} users={[makeUser({ handle: "testuser" })]} />,
      );
      const badgeLink = screen.getByLabelText("View badge SVG for testuser");
      expect(badgeLink).toBeDefined();
      expect(badgeLink.getAttribute("href")).toBe("/u/testuser/badge.svg");
    });

    it("opens badge SVG link in a new tab", () => {
      render(
        <AdminUserTable {...defaultProps} users={[makeUser({ handle: "testuser" })]} />,
      );
      const badgeLink = screen.getByLabelText("View badge SVG for testuser");
      expect(badgeLink.getAttribute("target")).toBe("_blank");
      expect(badgeLink.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("has a tooltip title on the badge link", () => {
      render(
        <AdminUserTable {...defaultProps} users={[makeUser({ handle: "testuser" })]} />,
      );
      const badgeLink = screen.getByTitle("View badge SVG");
      expect(badgeLink).toBeDefined();
    });
  });

  describe("sort integration", () => {
    it("passes onSort to header buttons", () => {
      const onSort = vi.fn();
      render(<AdminUserTable {...defaultProps} onSort={onSort} />);
      // Click the "Developer" sort button
      const devButton = screen.getByRole("button", { name: /Developer/i });
      fireEvent.click(devButton);
      expect(onSort).toHaveBeenCalledWith("handle");
    });

    it("passes current sortField and sortDir to headers", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          sortField="adjustedComposite"
          sortDir="desc"
        />,
      );
      // The Score column header should have aria-sort="descending"
      const headers = screen.getAllByRole("columnheader");
      const scoreHeader = headers.find((h) => h.textContent?.includes("Score"));
      expect(scoreHeader?.getAttribute("aria-sort")).toBe("descending");
    });
  });

  describe("null/missing data handling", () => {
    it("renders dash for null archetype", () => {
      const { container } = render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ archetype: null })]}
        />,
      );
      // mdash character (\u2014) or the HTML entity
      const cells = container.querySelectorAll("td");
      const archetypeCell = cells[1]!; // second td is archetype
      expect(archetypeCell.textContent).toContain("\u2014");
    });

    it("renders dash for null tier", () => {
      const { container } = render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ tier: null })]}
        />,
      );
      const cells = container.querySelectorAll("td");
      const tierCell = cells[2]!; // third td is tier
      expect(tierCell.textContent).toContain("\u2014");
    });

    it("renders dash for null score", () => {
      const { container } = render(
        <AdminUserTable
          {...defaultProps}
          users={[makeUser({ adjustedComposite: null })]}
        />,
      );
      const cells = container.querySelectorAll("td");
      const scoreCell = cells[3]!; // fourth td is score
      expect(scoreCell.textContent).toContain("\u2014");
    });
  });

  describe("image error handling", () => {
    it("shows initial letter fallback after image error", () => {
      render(
        <AdminUserTable
          {...defaultProps}
          users={[
            makeUser({
              handle: "badimg",
              avatarUrl: "https://example.com/broken.png",
            }),
          ]}
        />,
      );
      // Initially shows the image
      const img = screen.getByAltText("badimg's avatar");
      expect(img).toBeDefined();

      // Trigger image error
      fireEvent.error(img);

      // Now should show the initial letter
      expect(screen.getByText("B")).toBeDefined();
      // Image should be gone
      expect(screen.queryByAltText("badimg's avatar")).toBeNull();
    });
  });
});

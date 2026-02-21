// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdminSortableHeader, AdminHeaderCell } from "./AdminSortableHeader";

afterEach(cleanup);

// Helper to render a sortable header inside a table structure
function renderHeader(props: Partial<Parameters<typeof AdminSortableHeader>[0]> = {}) {
  const defaultProps = {
    field: "handle" as const,
    label: "Developer",
    sortField: "handle" as const,
    sortDir: "asc" as const,
    onSort: vi.fn(),
    ...props,
  };
  return render(
    <table>
      <thead>
        <tr>
          <AdminSortableHeader {...defaultProps} />
        </tr>
      </thead>
    </table>,
  );
}

describe("AdminSortableHeader — render tests", () => {
  describe("rendering", () => {
    it("renders without crashing", () => {
      renderHeader();
      expect(screen.getByRole("columnheader")).toBeDefined();
    });

    it("renders the label text", () => {
      renderHeader({ label: "Score" });
      expect(screen.getByText("Score")).toBeDefined();
    });

    it("renders a button inside the header cell", () => {
      renderHeader();
      expect(screen.getByRole("button")).toBeDefined();
    });

    it("header cell has scope=col", () => {
      renderHeader();
      const th = screen.getByRole("columnheader");
      expect(th.getAttribute("scope")).toBe("col");
    });
  });

  describe("sort callback", () => {
    it("calls onSort with the field when button is clicked", () => {
      const onSort = vi.fn();
      renderHeader({ field: "adjustedComposite", onSort });
      fireEvent.click(screen.getByRole("button"));
      expect(onSort).toHaveBeenCalledWith("adjustedComposite");
    });

    it("calls onSort with the correct field for different columns", () => {
      const onSort = vi.fn();
      renderHeader({ field: "tier", onSort });
      fireEvent.click(screen.getByRole("button"));
      expect(onSort).toHaveBeenCalledWith("tier");
    });
  });

  describe("aria-sort attribute", () => {
    it("sets aria-sort to ascending when this field is sorted asc", () => {
      renderHeader({ field: "handle", sortField: "handle", sortDir: "asc" });
      const th = screen.getByRole("columnheader");
      expect(th.getAttribute("aria-sort")).toBe("ascending");
    });

    it("sets aria-sort to descending when this field is sorted desc", () => {
      renderHeader({ field: "handle", sortField: "handle", sortDir: "desc" });
      const th = screen.getByRole("columnheader");
      expect(th.getAttribute("aria-sort")).toBe("descending");
    });

    it("sets aria-sort to none when a different field is sorted", () => {
      renderHeader({ field: "handle", sortField: "tier", sortDir: "asc" });
      const th = screen.getByRole("columnheader");
      expect(th.getAttribute("aria-sort")).toBe("none");
    });
  });

  describe("sort indicator icon", () => {
    it("renders an SVG sort indicator", () => {
      const { container } = renderHeader();
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("SVG icons are decorative (aria-hidden)", () => {
      const { container } = renderHeader();
      const svgs = container.querySelectorAll("svg");
      for (const svg of svgs) {
        expect(svg.getAttribute("aria-hidden")).toBe("true");
      }
    });

    it("active sort icon uses amber accent color class", () => {
      const { container } = renderHeader({
        field: "handle",
        sortField: "handle",
        sortDir: "desc",
      });
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("text-amber")).toBe(true);
    });

    it("inactive sort icon uses muted color class", () => {
      const { container } = renderHeader({
        field: "handle",
        sortField: "tier",
      });
      const svg = container.querySelector("svg");
      const classes = svg?.getAttribute("class") ?? "";
      expect(classes).toContain("text-text-secondary");
    });
  });

  describe("optional className", () => {
    it("appends className to the header cell", () => {
      renderHeader({ className: "hidden sm:table-cell" });
      const th = screen.getByRole("columnheader");
      expect(th.className).toContain("hidden");
      expect(th.className).toContain("sm:table-cell");
    });

    it("works without className prop", () => {
      renderHeader({ className: undefined });
      const th = screen.getByRole("columnheader");
      expect(th).toBeDefined();
    });
  });
});

describe("AdminHeaderCell — render tests", () => {
  function renderCell(props: { className?: string; children?: React.ReactNode } = {}) {
    return render(
      <table>
        <thead>
          <tr>
            <AdminHeaderCell {...props} />
          </tr>
        </thead>
      </table>,
    );
  }

  it("renders without crashing", () => {
    renderCell();
    expect(screen.getByRole("columnheader")).toBeDefined();
  });

  it("renders children", () => {
    renderCell({ children: <span>Actions</span> });
    expect(screen.getByText("Actions")).toBeDefined();
  });

  it("has scope=col", () => {
    renderCell();
    const th = screen.getByRole("columnheader");
    expect(th.getAttribute("scope")).toBe("col");
  });

  it("appends optional className", () => {
    renderCell({ className: "w-10" });
    const th = screen.getByRole("columnheader");
    expect(th.className).toContain("w-10");
  });

  it("does not render a button (non-sortable)", () => {
    renderCell({ children: "Static" });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

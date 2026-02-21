// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdminSearchBar } from "./AdminSearchBar";

afterEach(cleanup);

describe("AdminSearchBar — render tests", () => {
  const defaultProps = {
    search: "",
    onSearchChange: vi.fn(),
    resultCount: 0,
  };

  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<AdminSearchBar {...defaultProps} />);
      expect(screen.getByRole("textbox")).toBeDefined();
    });

    it("renders an input with type text", () => {
      render(<AdminSearchBar {...defaultProps} />);
      const input = screen.getByRole("textbox");
      expect(input.getAttribute("type")).toBe("text");
    });

    it("renders an input with the correct aria-label", () => {
      render(<AdminSearchBar {...defaultProps} />);
      const input = screen.getByLabelText("Filter users");
      expect(input).toBeDefined();
    });

    it("renders a placeholder for filtering", () => {
      render(<AdminSearchBar {...defaultProps} />);
      const input = screen.getByPlaceholderText(/filter/i);
      expect(input).toBeDefined();
    });

    it("renders the prompt character", () => {
      const { container } = render(<AdminSearchBar {...defaultProps} />);
      expect(container.textContent).toContain(">");
    });
  });

  describe("controlled value", () => {
    it("reflects the search prop in the input value", () => {
      render(<AdminSearchBar {...defaultProps} search="test-query" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("test-query");
    });

    it("reflects an empty search prop as empty input", () => {
      render(<AdminSearchBar {...defaultProps} search="" />);
      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("");
    });
  });

  describe("onChange behavior", () => {
    it("calls onSearchChange when user types", () => {
      const onSearchChange = vi.fn();
      render(<AdminSearchBar {...defaultProps} onSearchChange={onSearchChange} />);
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "hello" } });
      expect(onSearchChange).toHaveBeenCalledWith("hello");
    });

    it("calls onSearchChange with empty string when input is cleared", () => {
      const onSearchChange = vi.fn();
      render(
        <AdminSearchBar {...defaultProps} search="abc" onSearchChange={onSearchChange} />,
      );
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "" } });
      expect(onSearchChange).toHaveBeenCalledWith("");
    });
  });

  describe("result count display", () => {
    it("does not show result count when search is empty", () => {
      render(<AdminSearchBar {...defaultProps} search="" resultCount={5} />);
      expect(screen.queryByText(/result/i)).toBeNull();
    });

    it("shows result count when search is active", () => {
      render(<AdminSearchBar {...defaultProps} search="foo" resultCount={3} />);
      expect(screen.getByText("3 results")).toBeDefined();
    });

    it("uses singular 'result' for count of 1", () => {
      render(<AdminSearchBar {...defaultProps} search="foo" resultCount={1} />);
      expect(screen.getByText("1 result")).toBeDefined();
    });

    it("uses plural 'results' for count of 0", () => {
      render(<AdminSearchBar {...defaultProps} search="foo" resultCount={0} />);
      expect(screen.getByText("0 results")).toBeDefined();
    });

    it("uses plural 'results' for count > 1", () => {
      render(<AdminSearchBar {...defaultProps} search="bar" resultCount={42} />);
      expect(screen.getByText("42 results")).toBeDefined();
    });
  });
});

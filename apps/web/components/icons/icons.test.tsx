// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  GitHubIcon,
  CopyIcon,
  BitbucketIcon,
  CodebergIcon,
  GitlabIcon,
} from "./index";

describe("shared icons", () => {
  describe("GitHubIcon", () => {
    it("renders an svg with the octocat fill path and aria-hidden", () => {
      const { container } = render(<GitHubIcon />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg?.getAttribute("fill")).toBe("currentColor");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      const path = svg?.querySelector("path");
      expect(path?.getAttribute("d")).toContain("M12 0c-6.626 0-12 5.373-12 12");
    });

    it("forwards a className to the svg element", () => {
      const { container } = render(<GitHubIcon className="w-4 h-4 text-text-secondary" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("class")).toBe("w-4 h-4 text-text-secondary");
    });

    it("renders no class attribute when className is omitted", () => {
      const { container } = render(<GitHubIcon />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("class")).toBeNull();
    });
  });

  describe("CopyIcon", () => {
    it("renders a stroke svg with the clipboard rect + path and aria-hidden", () => {
      const { container } = render(<CopyIcon />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg?.getAttribute("fill")).toBe("none");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
      expect(svg?.getAttribute("stroke-width")).toBe("1.5");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      const rect = svg?.querySelector("rect");
      expect(rect?.getAttribute("x")).toBe("9");
      expect(rect?.getAttribute("y")).toBe("9");
      const path = svg?.querySelector("path");
      expect(path?.getAttribute("d")).toContain("M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
    });

    it("forwards a className to the svg element", () => {
      const { container } = render(<CopyIcon className="w-3.5 h-3.5" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("class")).toBe("w-3.5 h-3.5");
    });
  });

  describe.each([
    ["BitbucketIcon", BitbucketIcon, "M.778 1.211a.768.768 0 00-.768.892"],
    ["CodebergIcon", CodebergIcon, "M11.955.49A12 12 0 0 0 0 12.49"],
    ["GitlabIcon", GitlabIcon, "m23.6004 9.5927"],
  ] as const)("%s", (_name, Icon, pathStart) => {
    it("renders a fill svg with the brand path and aria-hidden", () => {
      const { container } = render(<Icon className="h-4 w-4 text-text-secondary" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg?.getAttribute("fill")).toBe("currentColor");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("class")).toBe("h-4 w-4 text-text-secondary");
      const path = svg?.querySelector("path");
      expect(path?.getAttribute("d")?.startsWith(pathStart)).toBe(true);
    });
  });
});

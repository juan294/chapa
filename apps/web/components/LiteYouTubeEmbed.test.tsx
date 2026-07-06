// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { LiteYouTubeEmbed } from "./LiteYouTubeEmbed";

afterEach(() => cleanup());

describe("LiteYouTubeEmbed", () => {
  const defaultProps = {
    videoId: "dQw4w9WgXcQ",
    title: "Scoring Explainer",
  };

  it("renders a thumbnail with play button before interaction", () => {
    render(<LiteYouTubeEmbed {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: /play scoring explainer/i,
    });
    expect(button).toBeDefined();

    // Should NOT have an iframe yet
    expect(screen.queryByTitle("Scoring Explainer")).toBeNull();
  });

  it("renders the thumbnail image from YouTube", () => {
    const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toContain("dQw4w9WgXcQ");
    expect(img!.getAttribute("alt")).toBe("Scoring Explainer");
  });

  it("sets explicit width/height on the thumbnail to prevent CLS", () => {
    const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);

    const img = container.querySelector("img");
    expect(img!.getAttribute("width")).toBe("480");
    expect(img!.getAttribute("height")).toBe("270");
  });

  it("loads the iframe when play button is clicked", () => {
    render(<LiteYouTubeEmbed {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: /play scoring explainer/i,
    });
    fireEvent.click(button);

    const iframe = screen.getByTitle("Scoring Explainer");
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute("src")).toContain("dQw4w9WgXcQ");
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
  });

  it("removes the play button after clicking", () => {
    render(<LiteYouTubeEmbed {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: /play scoring explainer/i,
    });
    fireEvent.click(button);

    expect(
      screen.queryByRole("button", { name: /play scoring explainer/i })
    ).toBeNull();
  });

  it("uses hqdefault thumbnail by default", () => {
    const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);
    const img = container.querySelector("img");
    expect(img!.getAttribute("src")).toContain("hqdefault.jpg");
  });

  it("applies 16:9 aspect ratio container", () => {
    const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("aspect-video");
  });

  it("renders without videoId as a placeholder", () => {
    render(<LiteYouTubeEmbed videoId="" title="Coming Soon" />);

    // Should show a placeholder state, not crash
    const button = screen.getByRole("button", {
      name: /play coming soon/i,
    });
    expect(button).toBeDefined();
  });
});

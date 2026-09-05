// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
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

  it("replaces a failed thumbnail with a neutral surface and keeps playback lazy and accessible", () => {
    const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);
    fireEvent.error(screen.getByRole("img", { name: defaultProps.title }));

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    const play = screen.getByRole("button", { name: "Play Scoring Explainer" });
    expect(play.querySelector('[aria-hidden="true"].bg-purple-tint')).not.toBeNull();
    fireEvent.click(play);
    const iframe = screen.getByTitle(defaultProps.title);
    expect(iframe.getAttribute("src")).toBe(`https://www.youtube-nocookie.com/embed/${defaultProps.videoId}?autoplay=1&rel=0`);
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("handles a thumbnail that failed before hydration attached its error listener", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    try {
      const { container } = render(<LiteYouTubeEmbed {...defaultProps} />);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByRole("button", { name: "Play Scoring Explainer" })).toBeDefined();
      expect(container.querySelector("iframe")).toBeNull();
    } finally { complete.mockRestore(); width.mockRestore(); }
  });

  it("attempts the new thumbnail when the video changes after an image failure", () => {
    const { rerender } = render(<LiteYouTubeEmbed {...defaultProps} />);
    fireEvent.error(screen.getByRole("img", { name: defaultProps.title }));
    expect(screen.queryByRole("img")).toBeNull();

    rerender(<LiteYouTubeEmbed videoId="new-video" title="New explainer" />);
    expect(screen.getByRole("img", { name: "New explainer" }).getAttribute("src")).toContain("new-video");
    expect(screen.queryByTitle("New explainer")).toBeNull();
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

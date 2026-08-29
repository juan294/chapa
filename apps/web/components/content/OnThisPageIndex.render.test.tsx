// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { OnThisPageIndex } from "./OnThisPageIndex";
import { ContentPageHeader } from "./ContentPageHeader";

afterEach(cleanup);

const ITEMS = [
  { id: "one", label: "The five dimensions" },
  { id: "two", label: "Caps and weights" },
];

describe("OnThisPageIndex (#1218)", () => {
  it("renders one link per section, pointing at its anchor", () => {
    render(<OnThisPageIndex items={ITEMS} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#one", "#two"]);
  });

  it("renders nothing when there are no sections to index", () => {
    const { container } = render(<OnThisPageIndex items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("works without IntersectionObserver, with no item marked current", () => {
    // jsdom has no IntersectionObserver. The list must still render and link;
    // only the active-item highlight depends on it.
    expect(
      (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver,
    ).toBeUndefined();
    render(<OnThisPageIndex items={ITEMS} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(0);
  });

  it("observes each section that exists in the document", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
        takeRecords = vi.fn();
        root = null;
        rootMargin = "";
        thresholds = [];
      },
    );
    const section = document.createElement("section");
    section.id = "one";
    document.body.appendChild(section);

    const { unmount } = render(<OnThisPageIndex items={ITEMS} />);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(section);

    unmount();
    expect(disconnect).toHaveBeenCalled();
    section.remove();
    vi.unstubAllGlobals();
  });
});

describe("ContentPageHeader (#1218)", () => {
  it("pairs the terminal marker with the page title", () => {
    const { container } = render(
      <ContentPageHeader
        command="chapa explain --scoring"
        title="Scoring Methodology"
        intro="Full transparency."
      />,
    );
    expect(container.textContent).toContain("% chapa explain --scoring");
    expect(
      screen.getByRole("heading", { level: 1 }).textContent,
    ).toContain("Scoring Methodology");
    expect(screen.getByText("Full transparency.")).toBeDefined();
  });

  it("omits the intro paragraph when there is none", () => {
    const { container } = render(
      <ContentPageHeader command="chapa explain" title="About" />,
    );
    expect(container.querySelector("p")).toBeNull();
  });
});

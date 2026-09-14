// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArchetypeExplorer } from "./ArchetypeExplorer";
const ids = ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"];
const items = ids.map((id) => ({ id, label: id, description: `${id} description`, glyph: "+", dimensions: [{ label: "Delivery", value: 50 }] }));
afterEach(cleanup);
describe("ArchetypeExplorer", () => {
  it("supports roving keyboard tabs, wrapping and Home/End for all seven guides", () => {
    render(<ArchetypeExplorer items={items} label="Archetypes" guideLabel="Read guide" sampleLabel="Illustrative profile" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(tabs[6]!.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[6]);
    fireEvent.keyDown(tabs[6]!, { key: "Home" });
    fireEvent.keyDown(tabs[0]!, { key: "End" });
    expect(screen.getByRole("link").getAttribute("href")).toBe("/archetypes/emerging");
  });
  it("accepts only known scoped selections and unregisters on unmount", () => {
    const { unmount } = render(<ArchetypeExplorer items={items} label="Archetypes" guideLabel="Read guide" sampleLabel="Illustrative profile" />);
    fireEvent(window, new CustomEvent("chapa:landing-archetype", { detail: { id: "artificer" } }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toContain("artificer");
    fireEvent(window, new CustomEvent("chapa:landing-archetype", { detail: { id: "unknown" } }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toContain("artificer");
    unmount();
    fireEvent(window, new CustomEvent("chapa:landing-archetype", { detail: { id: "builder" } }));
  });
});

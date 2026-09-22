// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DimensionExplorer } from "./DimensionExplorer";
afterEach(cleanup);
const items = ["delivery", "quality", "consistency", "breadth", "craft"].map((id) => ({ id, label: id, description: `${id} explained`, value: 92 }));
describe("DimensionExplorer", () => {
  it("preserves native open and closed choices when translated items rerender", () => {
    const { container, rerender } = render(<DimensionExplorer items={items} optionalLabel="Optional" />);
    const delivery = container.querySelector<HTMLDetailsElement>('[data-dimension="delivery"]')!;
    delivery.open = false;
    fireEvent(delivery, new Event("toggle"));
    fireEvent(window, new CustomEvent("chapa:landing-dimension", { detail: { id: "craft" } }));

    rerender(<DimensionExplorer items={items.map((item) => ({ ...item, label: `ES ${item.label}`, description: `ES ${item.description}` }))} optionalLabel="Opcional" />);

    expect(screen.getByText("ES delivery explained").closest("details")?.open).toBe(false);
    expect(screen.getByText("ES craft explained").closest("details")?.open).toBe(true);
    expect(container.querySelectorAll("details[open]")).toHaveLength(1);
  });

  it("keeps native details and opens the selected optional Craft detail from a scoped command", () => {
    const { container } = render(<DimensionExplorer items={items} optionalLabel="Optional" />);
    expect(container.querySelectorAll("details")).toHaveLength(5);
    fireEvent(window, new CustomEvent("chapa:landing-dimension", { detail: { id: "craft" } }));
    expect(screen.getByText("craft explained").closest("details")?.open).toBe(true);
    fireEvent(window, new CustomEvent("chapa:landing-dimension", { detail: { id: "unknown" } }));
    expect(container.querySelectorAll("details[open]")).toHaveLength(2);
  });
});

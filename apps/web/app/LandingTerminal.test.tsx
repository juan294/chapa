// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LandingTerminal } from "./LandingTerminal";
import type { GlobalCommandBarProps } from "@/components/GlobalCommandBar";
import { executeCommand } from "@/components/terminal/command-registry";

vi.mock("@/components/GlobalCommandBarLazy", () => ({
  GlobalCommandBarLazy: ({scopedCommands = [], onCustomAction}: GlobalCommandBarProps) => <div>{scopedCommands.map(command => <button key={command.name} onClick={() => {
    const action = executeCommand(command.name, scopedCommands).action;
    if (action?.type === "custom") void onCustomAction?.(action).then(lines => { if (lines) document.getElementById("result")!.textContent = lines[0]!.text; });
  }}>{command.name}</button>)}<output id="result" /></div>,
}));
afterEach(cleanup);
describe("LandingTerminal scoped composition", () => {
  it("exposes landing commands without creating a second terminal", () => {
    render(<LandingTerminal />);
    expect(screen.getByRole("button", {name: "/whoami"})).toBeDefined();
    expect(screen.getByRole("button", {name: "/dimensions"})).toBeDefined();
    expect(screen.queryByRole("button", {name: "/admin"})).toBeNull();
  });
  it.each([true, false])("reports actual clipboard completion %s", async copied => {
    const listener = (event: Event) => (event as CustomEvent<{complete: (ok: boolean) => void}>).detail.complete(copied);
    window.addEventListener("chapa:landing-copy", listener);
    try {
      render(<LandingTerminal />);
      fireEvent.click(screen.getByRole("button", {name: "/copy"}));
      await waitFor(() => expect(screen.getByRole("status").textContent).toContain(copied ? "copied" : "failed"));
    } finally {window.removeEventListener("chapa:landing-copy", listener);}
  });
});

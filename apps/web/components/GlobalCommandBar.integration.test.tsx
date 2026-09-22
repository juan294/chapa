// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { GlobalCommandBar } from "./GlobalCommandBar";
import type { OutputLine } from "./terminal/command-registry";

vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn()}), usePathname: () => "/"}));
vi.mock("next-themes", () => ({useTheme: () => ({theme: "system", setTheme: vi.fn()})}));
vi.mock("./KeyboardShortcutsListener", () => ({KeyboardShortcutsListener: () => null}));
afterEach(cleanup);

function submit(input: HTMLElement, value: string) {
  fireEvent.change(input, {target: {value}});
  fireEvent.keyDown(input, {key: "Enter"});
}

describe("real terminal input composition", () => {
  it("recalls multiple history entries without autocomplete intercepting the second ArrowUp", () => {
    render(<GlobalCommandBar />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    submit(input, "/theme dark");
    submit(input, "/help");
    fireEvent.keyDown(input, {key: "ArrowUp"});
    expect(input.value).toBe("/help");
    fireEvent.keyDown(input, {key: "ArrowUp"});
    expect(input.value).toBe("/theme dark");
    fireEvent.keyDown(input, {key: "ArrowDown"});
    expect(input.value).toBe("/help");
  });
  it("ignores a pending custom result after newer input clears it", async () => {
    let complete!: (lines: OutputLine[]) => void;
    const pending = new Promise<OutputLine[]>(resolve => {complete = resolve;});
    render(<GlobalCommandBar scopedCommands={[{name: "/copy", description: "Copy", execute: () => ({lines: [], action: {type: "custom", event: "chapa:landing-copy"}})}]} onCustomAction={() => pending} />);
    const input = screen.getByRole("combobox");
    submit(input, "/copy");
    fireEvent.change(input, {target: {value: "new input"}});
    await act(async () => complete([{id: "copy", type: "success", text: "Old copy completed"}]));
    expect(screen.queryByText("Old copy completed")).toBeNull();
  });
});

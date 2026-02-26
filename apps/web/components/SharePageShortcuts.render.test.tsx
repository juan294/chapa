// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SharePageShortcuts } from "./SharePageShortcuts";

const mockRegister = vi.fn(() => vi.fn());

vi.mock("./KeyboardShortcutsProvider", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: mockRegister,
  }),
}));

afterEach(() => {
  cleanup();
  mockRegister.mockClear();
});

describe("SharePageShortcuts", () => {
  it("renders null (renderless component)", () => {
    const { container } = render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={true}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("registers page shortcuts on mount", () => {
    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={true}
      />,
    );
    expect(mockRegister).toHaveBeenCalledWith("share", expect.any(Function));
  });

  it("handler handles copy-embed shortcut", () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={true}
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("copy-embed");
    expect(mockWriteText).toHaveBeenCalledWith("![badge](url)");
  });

  it("handler handles download-svg shortcut", () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = origCreate("a");
        el.click = clickSpy;
        return el;
      }
      return origCreate(tag);
    });

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={true}
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("download-svg");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handler handles refresh-badge shortcut when owner", () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={true}
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("refresh-badge");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/refresh?handle=testuser",
      { method: "POST" },
    );
    vi.unstubAllGlobals();
  });

  it("handler does not refresh when not owner", () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
        isOwner={false}
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("refresh-badge");
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

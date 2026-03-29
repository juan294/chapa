// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SharePageShortcuts } from "./SharePageShortcuts";
import type { SessionUser } from "@/hooks/useSession";

interface UseSessionReturn { session: SessionUser | null; loading: boolean; invalidate: () => void }
const mockUseSession = vi.fn<() => UseSessionReturn>();

vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

const mockRegister = vi.fn(() => vi.fn());

vi.mock("./KeyboardShortcutsListener", () => ({
  useKeyboardShortcutsContext: () => ({
    registerPageShortcuts: mockRegister,
  }),
}));

/** Mock session via useSession hook. */
function mockSessionAs(login: string | null) {
  mockUseSession.mockReturnValue({
    session: login ? { login, name: null, avatar_url: "" } : null,
    loading: false,
    invalidate: vi.fn(),
  });
}

beforeEach(() => {
  mockSessionAs(null); // default: not logged in
});

afterEach(() => {
  cleanup();
  mockRegister.mockClear();
  vi.restoreAllMocks();
});

describe("SharePageShortcuts", () => {
  it("renders null (renderless component)", () => {
    const { container } = render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("registers page shortcuts on mount", () => {
    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
       
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
       
      />,
    );

    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("download-svg");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handler handles refresh-badge shortcut when owner", () => {
    mockSessionAs("testuser");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
      />,
    );

    // With synchronous hook, the handler is registered with isOwner=true on first render
    const lastCall = mockRegister.mock.calls[mockRegister.mock.calls.length - 1] as unknown[];
    const handler = lastCall[1] as (id: string) => void;
    handler("refresh-badge");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/refresh?handle=testuser",
      { method: "POST" },
    );
  });

  it("handler does not refresh when not owner", () => {
    mockSessionAs("otheruser");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

    render(
      <SharePageShortcuts
        embedMarkdown="![badge](url)"
        handle="testuser"
      />,
    );

    // Get the handler (isOwner is false since handles don't match)
    const handler = (mockRegister.mock.calls as unknown[][])[0]![1] as (id: string) => void;
    handler("refresh-badge");

    // Fetch should NOT have been called for the refresh
    const refreshCalls = fetchSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/api/refresh"),
    );
    expect(refreshCalls).toHaveLength(0);
  });
});

// @vitest-environment jsdom
//
// Regression test for #1068 (FE-M2): all keyboard shortcuts (including the
// "?" cheat sheet — the discovery affordance for the whole shortcut system)
// were inert on the share page until the visitor manually summoned the
// command bar (click the hint or press "/"). KeyboardShortcutsListener only
// mounted inside GlobalCommandBar, which CommandBarHint only rendered after
// `summoned` became true. This test asserts shortcuts work from first paint,
// with the hint chip still showing and the command bar never summoned.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act, screen } from "@testing-library/react";
import { CommandBarHint } from "./CommandBarHint";
import { SharePageShortcuts } from "./SharePageShortcuts";
import type { SessionUser } from "@/hooks/useSession";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

interface UseSessionReturn {
  session: SessionUser | null;
  loading: boolean;
  invalidate: () => void;
}
const mockUseSession = vi.fn<() => UseSessionReturn>();
vi.mock("@/hooks/useSession", () => ({
  useSession: () => mockUseSession(),
}));

afterEach(cleanup);

describe("CommandBarHint + shortcuts integration (#1068)", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      session: null,
      loading: false,
      invalidate: vi.fn(),
    });
  });

  it("fires the share-page copy-embed shortcut before the command bar is summoned", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <>
        <CommandBarHint />
        <SharePageShortcuts embedMarkdown="![badge](url)" handle="testuser" />
      </>,
    );

    // Sanity check: the command bar has NOT been summoned.
    expect(screen.getByTestId("command-bar-hint")).toBeDefined();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "c",
          metaKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );
    });

    expect(writeText).toHaveBeenCalledWith("![badge](url)");
    // Still not summoned — the fix decouples the listener from the bar.
    expect(screen.getByTestId("command-bar-hint")).toBeDefined();
  });

  it("opens the '?' cheat sheet before the command bar is summoned", async () => {
    render(<CommandBarHint />);

    expect(screen.getByTestId("command-bar-hint")).toBeDefined();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true }),
      );
    });

    expect(await screen.findByRole("dialog")).toBeDefined();
    // Summoning the bar is a separate affordance — the cheat sheet does not
    // require it.
    expect(screen.queryByTestId("global-command-bar")).toBeNull();
  });
});

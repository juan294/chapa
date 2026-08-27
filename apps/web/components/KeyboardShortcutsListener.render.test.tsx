// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import dynamic from "next/dynamic";
import { resolveDynamicLoader } from "@/lib/test-helpers/dynamic-mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/keyboard/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: () => {},
}));

vi.mock("@/lib/keyboard/shortcuts", () => ({
  ShortcutScope: {},
  TERMINAL_COMMAND_INPUT_ID: "terminal-command-input",
}));

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => true),
  isWebmcpEnabledSync: vi.fn(() => false),
  isInsightsEnabledSync: vi.fn(() => false),
  isBitbucketEnabledSync: vi.fn(() => false),
  isCodebergEnabledSync: vi.fn(() => false),
  isGitlabEnabledSync: vi.fn(() => false),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: vi.fn(() => {
    const MockShortcutCheatSheet = () => (
      <div data-testid="shortcut-cheat-sheet" />
    );
    MockShortcutCheatSheet.displayName = "DynamicMock";
    return MockShortcutCheatSheet;
  }),
}));

import { KeyboardShortcutsListener } from "./KeyboardShortcutsListener";

afterEach(cleanup);

describe("KeyboardShortcutsListener render", () => {
  it("renders the lazy-loaded cheat sheet wrapper", () => {
    render(<KeyboardShortcutsListener />);
  });

  it("resolves the deferred loader to ShortcutCheatSheet", async () => {
    const { ShortcutCheatSheet } = await import("./ShortcutCheatSheet");

    const resolved = await resolveDynamicLoader<typeof ShortcutCheatSheet>(
      dynamic,
    );

    expect(resolved).toBe(ShortcutCheatSheet);
  });
});

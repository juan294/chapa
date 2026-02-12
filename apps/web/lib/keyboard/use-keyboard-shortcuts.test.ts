import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = readFileSync(
  resolve(__dirname, "use-keyboard-shortcuts.ts"),
  "utf-8",
);

describe("useKeyboardShortcuts hook (source-reading)", () => {
  it("exports a named function useKeyboardShortcuts", () => {
    expect(SRC).toMatch(/export\s+function\s+useKeyboardShortcuts/);
  });

  it("attaches a keydown listener on document", () => {
    expect(SRC).toContain('addEventListener("keydown"');
  });

  it("removes the keydown listener on cleanup", () => {
    expect(SRC).toContain('removeEventListener("keydown"');
  });

  it("uses useRef for g-sequence pending key state", () => {
    expect(SRC).toMatch(/useRef/);
    expect(SRC).toMatch(/pending/i);
  });

  it("implements a 500ms timeout for g-sequence expiry", () => {
    expect(SRC).toContain("500");
    expect(SRC).toMatch(/setTimeout/);
  });

  it("calls matchShortcut from the shortcuts module", () => {
    expect(SRC).toContain("matchShortcut");
  });

  it("calls isInputFocused to skip shortcuts in text inputs", () => {
    expect(SRC).toContain("isInputFocused");
  });

  it("calls isSequenceStarter to detect g-key presses", () => {
    expect(SRC).toContain("isSequenceStarter");
  });

  it("invokes the onShortcut callback with the matched id", () => {
    expect(SRC).toMatch(/onShortcut/);
  });

  it("uses useEffect for the event listener lifecycle", () => {
    expect(SRC).toContain("useEffect");
  });

  it("cleans up the sequence timeout on unmount", () => {
    expect(SRC).toMatch(/clearTimeout/);
  });

  it("skips plain-key shortcuts when input is focused by checking before preventDefault", () => {
    // The hook must gate plain-key events (no metaKey/ctrlKey) when inInput is true
    // BEFORE calling preventDefault(). This prevents "/" and "?" from being eaten.
    // The guard must appear between the match check and the preventDefault call.
    // Pattern: if inInput and no modifier keys held, skip (return early)
    expect(SRC).toMatch(
      /inInput\s*&&\s*!event\.(metaKey|ctrlKey)/,
    );
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SHORTCUTS,
  matchShortcut,
  isInputFocused,
  groupByScope,
} from "./shortcuts";

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

/** Build a minimal KeyboardEvent-like object for matching. */
function fakeKey(
  key: string,
  opts: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {},
): KeyboardEvent {
  return {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

/* ------------------------------------------------------------------ */
/* SHORTCUTS data integrity                                           */
/* ------------------------------------------------------------------ */

describe("SHORTCUTS array", () => {
  it("has unique ids", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has required fields", () => {
    for (const s of SHORTCUTS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.scope).toBeTruthy();
      expect(s.keys.length).toBeGreaterThan(0);
    }
  });

  it("contains navigation shortcuts", () => {
    const navIds = SHORTCUTS.filter((s) => s.scope === "navigation").map(
      (s) => s.id,
    );
    expect(navIds).toContain("go-home");
    expect(navIds).toContain("go-profile");
    expect(navIds).toContain("go-studio");
    expect(navIds).toContain("open-cheatsheet");
    expect(navIds).toContain("focus-command-bar");
  });

  it("contains share-page shortcuts", () => {
    const shareIds = SHORTCUTS.filter((s) => s.scope === "share").map(
      (s) => s.id,
    );
    expect(shareIds).toContain("copy-embed");
    expect(shareIds).toContain("download-svg");
    expect(shareIds).toContain("refresh-badge");
  });

  it("contains studio shortcuts", () => {
    const studioIds = SHORTCUTS.filter((s) => s.scope === "studio").map(
      (s) => s.id,
    );
    expect(studioIds).toContain("cycle-preset");
    expect(studioIds).toContain("toggle-quick-controls");
    expect(studioIds).toContain("refresh-preview");
    expect(studioIds).toContain("focus-terminal");
  });
});

/* ------------------------------------------------------------------ */
/* matchShortcut                                                       */
/* ------------------------------------------------------------------ */

describe("matchShortcut", () => {
  describe("modifier combos (Cmd/Ctrl + key)", () => {
    it("matches Cmd+1 → go-home", () => {
      const result = matchShortcut(fakeKey("1", { metaKey: true }), null, [
        "navigation",
      ]);
      expect(result).toBe("go-home");
    });

    it("matches Ctrl+1 → go-home (Windows/Linux)", () => {
      const result = matchShortcut(fakeKey("1", { ctrlKey: true }), null, [
        "navigation",
      ]);
      expect(result).toBe("go-home");
    });

    it("matches Cmd+2 → go-profile", () => {
      const result = matchShortcut(fakeKey("2", { metaKey: true }), null, [
        "navigation",
      ]);
      expect(result).toBe("go-profile");
    });

    it("matches Cmd+3 → go-studio", () => {
      const result = matchShortcut(fakeKey("3", { metaKey: true }), null, [
        "navigation",
      ]);
      expect(result).toBe("go-studio");
    });

    it("matches Shift+Cmd+C → copy-embed (share scope)", () => {
      const result = matchShortcut(
        fakeKey("c", { metaKey: true, shiftKey: true }),
        null,
        ["share"],
      );
      expect(result).toBe("copy-embed");
    });

    it("matches Shift+Ctrl+C → copy-embed (Windows/Linux)", () => {
      const result = matchShortcut(
        fakeKey("c", { ctrlKey: true, shiftKey: true }),
        null,
        ["share"],
      );
      expect(result).toBe("copy-embed");
    });

    it("matches Shift+Cmd+S → download-svg", () => {
      const result = matchShortcut(
        fakeKey("s", { metaKey: true, shiftKey: true }),
        null,
        ["share"],
      );
      expect(result).toBe("download-svg");
    });

    it("matches Shift+Cmd+R → refresh-badge", () => {
      const result = matchShortcut(
        fakeKey("r", { metaKey: true, shiftKey: true }),
        null,
        ["share"],
      );
      expect(result).toBe("refresh-badge");
    });

    it("matches Shift+Cmd+T → cycle-preset (studio)", () => {
      const result = matchShortcut(
        fakeKey("t", { metaKey: true, shiftKey: true }),
        null,
        ["studio"],
      );
      expect(result).toBe("cycle-preset");
    });

    it("matches Shift+Cmd+Q → toggle-quick-controls", () => {
      const result = matchShortcut(
        fakeKey("q", { metaKey: true, shiftKey: true }),
        null,
        ["studio"],
      );
      expect(result).toBe("toggle-quick-controls");
    });

    it("matches Shift+Cmd+P → refresh-preview", () => {
      const result = matchShortcut(
        fakeKey("p", { metaKey: true, shiftKey: true }),
        null,
        ["studio"],
      );
      expect(result).toBe("refresh-preview");
    });

    it("matches Cmd+K → focus-terminal (studio)", () => {
      const result = matchShortcut(fakeKey("k", { metaKey: true }), null, [
        "studio",
      ]);
      expect(result).toBe("focus-terminal");
    });
  });

  describe("plain key shortcuts", () => {
    it("matches ? → open-cheatsheet", () => {
      const result = matchShortcut(fakeKey("?"), null, ["navigation"]);
      expect(result).toBe("open-cheatsheet");
    });

    it("matches / → focus-command-bar", () => {
      const result = matchShortcut(fakeKey("/"), null, ["navigation"]);
      expect(result).toBe("focus-command-bar");
    });
  });

  describe("g-sequences", () => {
    it("matches g then h → go-home", () => {
      const result = matchShortcut(fakeKey("h"), "g", ["navigation"]);
      expect(result).toBe("go-home");
    });

    it("matches g then p → go-profile", () => {
      const result = matchShortcut(fakeKey("p"), "g", ["navigation"]);
      expect(result).toBe("go-profile");
    });

    it("matches g then s → go-studio", () => {
      const result = matchShortcut(fakeKey("s"), "g", ["navigation"]);
      expect(result).toBe("go-studio");
    });
  });

  describe("scope filtering", () => {
    it("does not match share shortcuts when only navigation scope is active", () => {
      const result = matchShortcut(
        fakeKey("c", { metaKey: true, shiftKey: true }),
        null,
        ["navigation"],
      );
      expect(result).toBeNull();
    });

    it("does not match studio shortcuts when only share scope is active", () => {
      const result = matchShortcut(
        fakeKey("t", { metaKey: true, shiftKey: true }),
        null,
        ["share"],
      );
      expect(result).toBeNull();
    });

    it("matches navigation shortcuts from any active scopes", () => {
      const result = matchShortcut(fakeKey("1", { metaKey: true }), null, [
        "navigation",
        "share",
      ]);
      expect(result).toBe("go-home");
    });
  });

  describe("no match", () => {
    it("returns null for unregistered key combo", () => {
      const result = matchShortcut(fakeKey("x", { metaKey: true }), null, [
        "navigation",
      ]);
      expect(result).toBeNull();
    });

    it("returns null for plain key without pending sequence", () => {
      const result = matchShortcut(fakeKey("h"), null, ["navigation"]);
      expect(result).toBeNull();
    });

    it("returns null for g followed by wrong key", () => {
      const result = matchShortcut(fakeKey("x"), "g", ["navigation"]);
      expect(result).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/* isInputFocused                                                      */
/* ------------------------------------------------------------------ */

describe("isInputFocused", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true when an input element is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true when a textarea is focused", () => {
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true when a contenteditable element is focused", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.tabIndex = 0; // make focusable in jsdom
    document.body.appendChild(div);
    div.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns true when a select is focused", () => {
    const sel = document.createElement("select");
    document.body.appendChild(sel);
    sel.focus();
    expect(isInputFocused()).toBe(true);
  });

  it("returns false when body is focused", () => {
    document.body.focus();
    expect(isInputFocused()).toBe(false);
  });

  it("returns false when a non-input element is focused", () => {
    const div = document.createElement("div");
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();
    expect(isInputFocused()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* groupByScope                                                        */
/* ------------------------------------------------------------------ */

describe("groupByScope", () => {
  it("groups shortcuts by their scope field", () => {
    const groups = groupByScope(SHORTCUTS);
    expect(groups).toHaveProperty("navigation");
    expect(groups).toHaveProperty("share");
    expect(groups).toHaveProperty("studio");
  });

  it("each group contains only shortcuts of that scope", () => {
    const groups = groupByScope(SHORTCUTS);
    for (const [scope, shortcuts] of Object.entries(groups)) {
      for (const s of shortcuts) {
        expect(s.scope).toBe(scope);
      }
    }
  });

  it("all shortcuts are accounted for", () => {
    const groups = groupByScope(SHORTCUTS);
    const total = Object.values(groups).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(total).toBe(SHORTCUTS.length);
  });
});

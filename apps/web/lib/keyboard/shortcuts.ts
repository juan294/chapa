/**
 * Keyboard shortcuts — pure data + matching logic.
 * Zero React dependencies. Fully testable.
 */

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type ShortcutScope = "navigation" | "share" | "studio";

export interface KeyCombo {
  /** The `event.key` value (case-sensitive). */
  key: string;
  /** Requires Cmd (Mac) or Ctrl (Win/Linux). */
  mod?: boolean;
  /** Requires Shift. */
  shift?: boolean;
  /** Two-key sequence: this key must follow `pendingKey` within 500ms. */
  sequence?: string;
}

export interface Shortcut {
  id: string;
  label: string;
  scope: ShortcutScope;
  /** Display strings for the cheat sheet (e.g. ["⌘", "1"] or ["g", "h"]). */
  keys: string[];
  /** Alternative display strings (e.g. Ctrl variant). */
  altKeys?: string[];
  /** Matching rules — a shortcut may match via multiple combos. */
  combos: KeyCombo[];
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

export const SHORTCUTS: Shortcut[] = [
  /* ── Navigation ──────────────────────────────────────────────── */
  {
    id: "go-home",
    label: "Go to Home",
    scope: "navigation",
    keys: ["⌘", "1"],
    altKeys: ["g", "h"],
    combos: [
      { key: "1", mod: true },
      { key: "h", sequence: "g" },
    ],
  },
  {
    id: "go-profile",
    label: "Go to Profile",
    scope: "navigation",
    keys: ["⌘", "2"],
    altKeys: ["g", "p"],
    combos: [
      { key: "2", mod: true },
      { key: "p", sequence: "g" },
    ],
  },
  {
    id: "go-studio",
    label: "Go to Studio",
    scope: "navigation",
    keys: ["⌘", "3"],
    altKeys: ["g", "s"],
    combos: [
      { key: "3", mod: true },
      { key: "s", sequence: "g" },
    ],
  },
  {
    id: "open-cheatsheet",
    label: "Keyboard shortcuts",
    scope: "navigation",
    keys: ["?"],
    combos: [{ key: "?" }],
  },
  {
    id: "focus-command-bar",
    label: "Focus command bar",
    scope: "navigation",
    keys: ["/"],
    combos: [{ key: "/" }],
  },

  /* ── Share page ──────────────────────────────────────────────── */
  {
    id: "copy-embed",
    label: "Copy embed snippet",
    scope: "share",
    keys: ["⇧", "⌘", "C"],
    combos: [{ key: "c", mod: true, shift: true }],
  },
  {
    id: "download-svg",
    label: "Download badge SVG",
    scope: "share",
    keys: ["⇧", "⌘", "S"],
    combos: [{ key: "s", mod: true, shift: true }],
  },
  {
    id: "refresh-badge",
    label: "Refresh badge",
    scope: "share",
    keys: ["⇧", "⌘", "R"],
    combos: [{ key: "r", mod: true, shift: true }],
  },

  /* ── Studio ──────────────────────────────────────────────────── */
  {
    id: "cycle-preset",
    label: "Cycle preset",
    scope: "studio",
    keys: ["⇧", "⌘", "T"],
    combos: [{ key: "t", mod: true, shift: true }],
  },
  {
    id: "toggle-quick-controls",
    label: "Toggle Quick Controls",
    scope: "studio",
    keys: ["⇧", "⌘", "Q"],
    combos: [{ key: "q", mod: true, shift: true }],
  },
  {
    id: "refresh-preview",
    label: "Refresh preview",
    scope: "studio",
    keys: ["⇧", "⌘", "P"],
    combos: [{ key: "p", mod: true, shift: true }],
  },
  {
    id: "focus-terminal",
    label: "Focus terminal",
    scope: "studio",
    keys: ["⌘", "K"],
    combos: [{ key: "k", mod: true }],
  },
];

/* ------------------------------------------------------------------ */
/* Matching                                                           */
/* ------------------------------------------------------------------ */

function comboMatches(
  combo: KeyCombo,
  event: KeyboardEvent,
  pendingKey: string | null,
): boolean {
  // Sequence check: combo requires a pending key
  if (combo.sequence) {
    if (pendingKey !== combo.sequence) return false;
    // For sequence matches, ensure no modifiers are held
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return false;
    return event.key === combo.key;
  }

  // Non-sequence combo must NOT have a pending key active
  if (pendingKey) return false;

  // Modifier check (Cmd or Ctrl)
  const modHeld = event.metaKey || event.ctrlKey;
  if (combo.mod && !modHeld) return false;
  if (!combo.mod && modHeld) return false;

  // Shift check
  const shiftHeld = event.shiftKey;
  if (combo.shift && !shiftHeld) return false;
  if (!combo.shift && shiftHeld) return false;

  // Key match — case-insensitive for letter keys with Shift
  if (combo.shift) {
    return event.key.toLowerCase() === combo.key.toLowerCase();
  }
  return event.key === combo.key;
}

/**
 * Match a keyboard event against registered shortcuts.
 * Returns the shortcut id or null if no match.
 *
 * @param event       The keydown event
 * @param pendingKey  The first key of a two-key sequence (e.g. "g"), or null
 * @param activeScopes  Which scopes are currently active
 */
export function matchShortcut(
  event: KeyboardEvent,
  pendingKey: string | null,
  activeScopes: ShortcutScope[],
): string | null {
  for (const shortcut of SHORTCUTS) {
    if (!activeScopes.includes(shortcut.scope)) continue;
    for (const combo of shortcut.combos) {
      if (comboMatches(combo, event, pendingKey)) {
        return shortcut.id;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns true if the currently focused element is a text input. */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (
    (el as HTMLElement).isContentEditable ||
    (el as HTMLElement).getAttribute?.("contenteditable") === "true"
  )
    return true;
  return false;
}

/** Group shortcuts by scope for cheat sheet rendering. */
export function groupByScope(
  shortcuts: Shortcut[],
): Record<string, Shortcut[]> {
  const groups: Record<string, Shortcut[]> = {};
  for (const s of shortcuts) {
    if (!groups[s.scope]) groups[s.scope] = [];
    groups[s.scope].push(s);
  }
  return groups;
}

/** Check if a key event is the start of a g-sequence. */
export function isSequenceStarter(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  return event.key === "g";
}

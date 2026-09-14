"use client";

import { useState, useEffect, useCallback } from "react";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { isInputFocused, matchShortcut, TERMINAL_COMMAND_INPUT_ID } from "@/lib/keyboard/shortcuts";
import { useTranslation } from "@/lib/i18n";

/**
 * Progressive disclosure wrapper for the GlobalCommandBar (#783 / UX-S1).
 *
 * The share page is the surface most likely to be reached by non-developer
 * visitors via an embedded badge. Rendering the full terminal command bar to
 * every visitor reads as friction to that audience. Instead, we lead with a
 * subtle, discoverable hint ("Press / for commands") and only mount the
 * command bar once the visitor opts in — by clicking the hint or pressing "/".
 *
 * The terminal power surface and the "/" shortcut remain fully available; we
 * change the *initial presentation*, not the capability. Once summoned, the
 * existing `focus-command-bar` ("/") shortcut in KeyboardShortcutsListener
 * takes over and focuses the (now mounted) command input.
 *
 * `KeyboardShortcutsListener` is mounted here unconditionally — regardless
 * of `summoned` — so the global `navigation` scope, the "?" cheat sheet, and
 * page-scope shortcut registrations (e.g. `SharePageShortcuts`) all work
 * from first paint, not just after the visitor opts into the command bar
 * (#1068). The same listener instance stays mounted across the summon
 * transition, so `GlobalCommandBarLazy` is told to skip mounting its own via
 * `skipShortcutsListener` — mounting a second instance would publish the
 * module store twice and the loser's unmount cleanup would kill the
 * survivor's registrations.
 */
export function CommandBarHint({ isAdmin }: { isAdmin?: boolean } = {}) {
  const { t } = useTranslation();
  const [summoned, setSummoned] = useState(false);

  const summon = useCallback(() => {
    setSummoned(true);
  }, []);

  // Before mount, use the same Slash/Mod+K entry shortcuts as the full bar.
  // Skip text fields so typing does not summon the command bar.
  // After summoning, this effect unmounts and the KeyboardShortcutsListener's
  // own `focus-command-bar` handler owns the "/" shortcut.
  useEffect(() => {
    if (summoned) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey) return;
      if (matchShortcut(event, null, ["navigation"]) !== "focus-command-bar") return;
      if (isInputFocused()) return;
      event.preventDefault();
      setSummoned(true);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [summoned]);

  // Once summoned, move focus into the command input so a "/" keypress lands
  // the user directly in the terminal (the bar is lazy/SSR-disabled, so wait a
  // tick for it to mount).
  useEffect(() => {
    if (!summoned) return;
    const timer = setTimeout(() => {
      document
        .querySelector<HTMLInputElement>(`#${TERMINAL_COMMAND_INPUT_ID}`)
        ?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [summoned]);

  return (
    <>
      <KeyboardShortcutsListener />
      {summoned ? (
        <GlobalCommandBarLazy isAdmin={isAdmin} skipShortcutsListener />
      ) : (
        <button
          type="button"
          data-testid="command-bar-hint"
          onClick={summon}
          aria-label={t("commandHint.ariaLabel") as string}
          className="group fixed bottom-4 right-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-[3px] border border-stroke-strong bg-card px-3 py-1.5 font-terminal text-xs text-text-secondary shadow-card transition-colors hover:border-amber-text hover:text-text-primary motion-reduce:transition-none"
        >
          <kbd className="rounded border border-stroke bg-bg/60 px-1.5 py-0.5 font-terminal text-[0.7rem] leading-none text-amber-text group-hover:border-amber-text">
            /
          </kbd>
          {/* A real space between the key and the label, so the visible text
              reads "/ for commands" for assistive tech and matches the name. */}
          {" "}
          <span>{t("commandHint.label") as string}</span>
        </button>
      )}
    </>
  );
}

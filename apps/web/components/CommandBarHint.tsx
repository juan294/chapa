"use client";

import { useState, useEffect, useCallback } from "react";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { isInputFocused, TERMINAL_COMMAND_INPUT_ID } from "@/lib/keyboard/shortcuts";
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
 */
export function CommandBarHint({ isAdmin }: { isAdmin?: boolean } = {}) {
  const { t } = useTranslation();
  const [summoned, setSummoned] = useState(false);

  const summon = useCallback(() => {
    setSummoned(true);
  }, []);

  // While the hint is showing, listen for "/" to summon the command bar.
  // Skipped when the user is typing in a text field so "/" still reaches inputs.
  // After summoning, this effect unmounts and the KeyboardShortcutsListener's
  // own `focus-command-bar` handler owns the "/" shortcut.
  useEffect(() => {
    if (summoned) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
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

  if (summoned) {
    return <GlobalCommandBarLazy isAdmin={isAdmin} />;
  }

  return (
    <button
      type="button"
      data-testid="command-bar-hint"
      onClick={summon}
      aria-label={t("commandHint.ariaLabel") as string}
      className="group fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-lg border border-stroke bg-card/90 px-3 py-1.5 font-terminal text-xs text-text-secondary shadow-card backdrop-blur-md transition-colors hover:border-amber/30 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40 motion-reduce:transition-none"
    >
      <kbd className="rounded border border-stroke bg-bg/60 px-1.5 py-0.5 font-terminal text-[0.7rem] leading-none text-amber group-hover:border-amber/40">
        /
      </kbd>
      <span>{t("commandHint.label") as string}</span>
    </button>
  );
}

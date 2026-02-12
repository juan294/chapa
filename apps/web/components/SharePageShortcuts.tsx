"use client";

import { useEffect, useCallback } from "react";
import { useKeyboardShortcutsContext } from "./KeyboardShortcutsProvider";

interface SharePageShortcutsProps {
  embedMarkdown: string;
  handle: string;
  isOwner: boolean;
}

/**
 * Renderless client component that registers share-page keyboard shortcuts.
 * Must be rendered inside KeyboardShortcutsProvider.
 */
export function SharePageShortcuts({
  embedMarkdown,
  handle,
  isOwner,
}: SharePageShortcutsProps) {
  const { registerPageShortcuts } = useKeyboardShortcutsContext();

  const handler = useCallback(
    (id: string) => {
      switch (id) {
        case "copy-embed":
          navigator.clipboard.writeText(embedMarkdown).catch(() => {
            // Clipboard API may fail in non-secure contexts
          });
          break;
        case "download-svg": {
          const a = document.createElement("a");
          a.href = `/u/${encodeURIComponent(handle)}/badge.svg`;
          a.download = `${handle}-chapa-badge.svg`;
          a.click();
          break;
        }
        case "refresh-badge":
          if (isOwner) {
            fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
              method: "POST",
            }).then(() => {
              window.location.reload();
            }).catch(() => {
              // Silently fail
            });
          }
          break;
      }
    },
    [embedMarkdown, handle, isOwner],
  );

  useEffect(() => {
    return registerPageShortcuts("share", handler);
  }, [registerPageShortcuts, handler]);

  return null;
}

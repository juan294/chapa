"use client";

import { useEffect, useCallback } from "react";
import { useKeyboardShortcutsContext } from "./KeyboardShortcutsListener";
import { useSession } from "@/hooks/useSession";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useTranslation } from "@/lib/i18n";
import { Toast } from "@/components/Toast";

interface SharePageShortcutsProps {
  embedMarkdown: string;
  handle: string;
  // #1165 (FE-H2) — server-resolved display gate, threaded down from
  // `/u/[handle]`'s dynamic (non-ISR) render so this doesn't need to
  // re-derive ownership over a network round trip to `/api/auth/session`.
  // Optional so any other/future caller keeps working via the useSession()
  // fallback below.
  isOwner?: boolean;
}

/**
 * Renderless-by-default client component that registers share-page keyboard
 * shortcuts. Requires KeyboardShortcutsListener to be mounted.
 *
 * Renders a Toast only when the `copy-embed` shortcut's clipboard write is
 * rejected (#1165 / UX-M4) — previously this swallowed the rejection with no
 * feedback either way, unlike BadgeToolbar's copy-link path.
 */
export function SharePageShortcuts({
  embedMarkdown,
  handle,
  isOwner: isOwnerProp,
}: SharePageShortcutsProps) {
  const { session } = useSession();
  const isOwner = isOwnerProp ?? session?.login === handle;
  const { registerPageShortcuts } = useKeyboardShortcutsContext();
  const { t } = useTranslation();
  const { status: copyStatus, copy: copyEmbed, reset: resetCopyStatus } = useCopyToClipboard();

  const handler = useCallback(
    (id: string) => {
      switch (id) {
        case "copy-embed":
          void copyEmbed(embedMarkdown);
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
    [embedMarkdown, handle, isOwner, copyEmbed],
  );

  useEffect(() => {
    return registerPageShortcuts("share", handler);
  }, [registerPageShortcuts, handler]);

  if (copyStatus !== "failed") return null;

  return (
    <Toast
      message={t('badgeToolbar.failed') as string}
      type="error"
      duration={4000}
      onDismiss={resetCopyStatus}
    />
  );
}

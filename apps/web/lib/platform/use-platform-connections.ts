"use client";

import { useCallback, useEffect, useState } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { createModuleStore } from "@/hooks/createModuleStore";
import { fireAndForget } from "@/lib/async/fire-and-forget";

/**
 * Linked-platform connection state, shared by every surface that shows it
 * (#1223).
 *
 * This logic used to live inside `UserMenu`, as three near-identical state
 * triples and three near-identical unlink handlers. `/settings` needs exactly
 * the same behaviour, and #1191 is a recent enough lesson about what happens
 * when the same thing gets a second implementation — so it moved here rather
 * than being copied.
 *
 * The module-level cache is deliberate and predates this extraction: status is
 * fetched once per page load and survives remounts of the menu, so opening and
 * closing it does not re-probe three endpoints.
 */

export type PlatformId = "bitbucket" | "codeberg" | "gitlab";

export interface PlatformStatus {
  linked: boolean;
  remoteLogin: string | null;
}

interface PlatformStatusEntry {
  fetched: boolean;
  pending: boolean;
  status: PlatformStatus | null;
}

type PlatformStatusCache = Record<PlatformId, PlatformStatusEntry>;

export const PLATFORM_IDS: readonly PlatformId[] = [
  "bitbucket",
  "codeberg",
  "gitlab",
];

function emptyPlatformStatusCache(): PlatformStatusCache {
  const emptyEntry = (): PlatformStatusEntry => ({
    fetched: false,
    pending: false,
    status: null,
  });
  return {
    bitbucket: emptyEntry(),
    codeberg: emptyEntry(),
    gitlab: emptyEntry(),
  };
}

// Backed by the shared module-store primitive (#774). Read and written
// imperatively (in useState initializers, effects, and after unlink); there
// are no reactive subscribers, so `getSnapshot()`/`set()` are used directly.
const platformStatusStore = createModuleStore<PlatformStatusCache>(
  emptyPlatformStatusCache(),
);

export function clearPlatformStatusCache() {
  platformStatusStore.set(emptyPlatformStatusCache());
}

export interface PlatformConnection {
  platform: PlatformId;
  /** False when the platform's public feature flag is off. */
  enabled: boolean;
  status: PlatformStatus | null;
  unlinking: boolean;
}

export interface PlatformConnections {
  connections: PlatformConnection[];
  /** Resolves true when the account was unlinked, false on any failure. */
  unlink: (platform: PlatformId) => Promise<boolean>;
}

export function usePlatformConnections(): PlatformConnections {
  const { bitbucketEnabled, codebergEnabled, gitlabEnabled } =
    useClientFeatureFlags();

  const enabledByPlatform: Record<PlatformId, boolean> = {
    bitbucket: bitbucketEnabled,
    codeberg: codebergEnabled,
    gitlab: gitlabEnabled,
  };

  const [statuses, setStatuses] = useState<Record<PlatformId, PlatformStatus | null>>(
    () => ({
      bitbucket: platformStatusStore.getSnapshot().bitbucket.status,
      codeberg: platformStatusStore.getSnapshot().codeberg.status,
      gitlab: platformStatusStore.getSnapshot().gitlab.status,
    }),
  );
  const [unlinking, setUnlinking] = useState<Record<PlatformId, boolean>>({
    bitbucket: false,
    codeberg: false,
    gitlab: false,
  });

  useEffect(() => {
    // Only probe the status endpoint for platforms whose public feature flag
    // is enabled. When an integration is flag-gated OFF we skip the network
    // call entirely instead of relying on the server to answer
    // `{ enabled: false }`, avoiding wasted requests on every mount (#885).
    // The server still has the final say for enabled platforms.
    function fetchPlatformStatus(platform: PlatformId) {
      const entry = platformStatusStore.getSnapshot()[platform];
      if (entry.fetched || entry.pending) return;

      platformStatusStore.set({
        ...platformStatusStore.getSnapshot(),
        [platform]: { ...entry, pending: true },
      });
      fireAndForget(
        () =>
          fetch(`/api/auth/${platform}/status`)
            .then((r) => r.json())
            .then((data) => {
              const status = data.enabled
                ? { linked: data.linked, remoteLogin: data.remoteLogin }
                : null;
              platformStatusStore.set({
                ...platformStatusStore.getSnapshot(),
                [platform]: { fetched: true, pending: false, status },
              });
              if (data.enabled) {
                setStatuses((prev) => ({ ...prev, [platform]: status }));
              }
            }),
        () => {
          platformStatusStore.set({
            ...platformStatusStore.getSnapshot(),
            [platform]: {
              ...platformStatusStore.getSnapshot()[platform],
              pending: false,
            },
          });
        },
      ); // Graceful — the surface works without status
    }

    if (bitbucketEnabled) fetchPlatformStatus("bitbucket");
    if (codebergEnabled) fetchPlatformStatus("codeberg");
    if (gitlabEnabled) fetchPlatformStatus("gitlab");
  }, [bitbucketEnabled, codebergEnabled, gitlabEnabled]);

  const unlink = useCallback(async (platform: PlatformId): Promise<boolean> => {
    setUnlinking((prev) => ({ ...prev, [platform]: true }));
    try {
      const res = await fetch(`/api/auth/${platform}/disconnect`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success === true) {
        clearPlatformStatusCache();
        setStatuses((prev) => ({
          ...prev,
          [platform]: { linked: false, remoteLogin: null },
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setUnlinking((prev) => ({ ...prev, [platform]: false }));
    }
  }, []);

  return {
    connections: PLATFORM_IDS.map((platform) => ({
      platform,
      enabled: enabledByPlatform[platform],
      status: statuses[platform],
      unlinking: unlinking[platform],
    })),
    unlink,
  };
}

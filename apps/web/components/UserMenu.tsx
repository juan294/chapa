"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  isInsightsEnabledSync,
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isGitlabEnabledSync,
} from "@/lib/feature-flags-sync";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { clearSessionCache } from "@/hooks/useSession";
import { clearCacheWarmState } from "@/hooks/useOwnerCacheWarm";
import { useDropdownMenu } from "@/hooks/useDropdownMenu";
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";
import { createModuleStore } from "@/hooks/createModuleStore";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { useTranslation } from "@/lib/i18n";
import {
  GitHubIcon,
  BitbucketIcon,
  CodebergIcon,
  GitlabIcon,
} from "@/components/icons";
import { ConfirmDialog } from "./ConfirmDialog";
import { Toast } from "./Toast";

/** Module-level cache for platform status fetches — persists across mounts. */
interface PlatformStatus {
  linked: boolean;
  remoteLogin: string | null;
}
interface PlatformStatusCache {
  fetched: boolean;
  bitbucket: PlatformStatus | null;
  codeberg: PlatformStatus | null;
  gitlab: PlatformStatus | null;
}

function emptyPlatformStatusCache(): PlatformStatusCache {
  return { fetched: false, bitbucket: null, codeberg: null, gitlab: null };
}

// Backed by the shared module-store primitive (#774). This cache is read
// imperatively (in useState initializers and effects) and written
// imperatively after fetches/unlinks — there are no reactive subscribers, so
// `getSnapshot()`/`set()` are used directly. The single shared object instance
// (returned by `getSnapshot()`) preserves the previous field-mutation
// semantics exactly: callers mutate fields in place, and `set()` is only used
// to swap in a fresh object on clear.
const platformStatusStore = createModuleStore<PlatformStatusCache>(
  emptyPlatformStatusCache(),
);

/** Clear the platform status cache — call after link/unlink actions */
export function clearPlatformStatusCache() {
  platformStatusStore.set(emptyPlatformStatusCache());
}

interface UserMenuProps {
  login: string;
  name: string | null;
  avatarUrl: string;
  isAdmin?: boolean;
}

export function UserMenu({ login, name, avatarUrl, isAdmin }: UserMenuProps) {
  const router = useRouter();
  const { studioEnabled } = useClientFeatureFlags();
  const { t } = useTranslation();
  const insightsStorageKey = `chapa_insights_last_submitted_${login}`;
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen: open, setIsOpen: setOpen } = useDropdownMenu(menuRef);
  const { shouldRender: showDropdown, isAnimatingOut: dropdownExiting } =
    useAnimatedUnmount(open, 200);

  const [bbStatus, setBbStatus] = useState<{
    linked: boolean;
    remoteLogin: string | null;
  } | null>(() => platformStatusStore.getSnapshot().bitbucket);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const [cbStatus, setCbStatus] = useState<{
    linked: boolean;
    remoteLogin: string | null;
  } | null>(() => platformStatusStore.getSnapshot().codeberg);
  const [showCbUnlinkConfirm, setShowCbUnlinkConfirm] = useState(false);
  const [cbUnlinkLoading, setCbUnlinkLoading] = useState(false);

  const [glStatus, setGlStatus] = useState<{
    linked: boolean;
    remoteLogin: string | null;
  } | null>(() => platformStatusStore.getSnapshot().gitlab);
  const [showGlUnlinkConfirm, setShowGlUnlinkConfirm] = useState(false);
  const [glUnlinkLoading, setGlUnlinkLoading] = useState(false);

  // Insights import — file picker triggered directly from menu
  const insightsFileRef = useRef<HTMLInputElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    detail?: string;
    type: "loading" | "success" | "error" | "info";
  } | null>(null);
  const handleToastDismiss = useCallback(() => setToast(null), []);

  // Insights cooldown — read last-submitted timestamp from localStorage.
  // State is seeded with deterministic defaults (0 / null) so the initial
  // server and client renders match; the real values are populated in a
  // mount-time effect below to avoid hydration mismatches and the use of
  // Date.now()/localStorage inside a useState initializer (#892).
  const INSIGHTS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
  const [insightsNow, setInsightsNow] = useState(0);
  const [insightsLastSubmitted, setInsightsLastSubmitted] = useState<Date | null>(null);

  useEffect(() => {
    // Read the cooldown timestamp from localStorage and capture "now" AFTER
    // mount so the initial server/client render stays deterministic (#892):
    // we never call Date.now() or touch localStorage inside a useState
    // initializer. Setting state here is the intended client-only hydration of
    // browser-derived values; the rule below is a false positive for that case.
    setInsightsNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    if (typeof window === "undefined" || !window.localStorage) return;
    const stored = window.localStorage.getItem(insightsStorageKey);
    if (!stored) return;
    try {
      const date = new Date(stored);
      if (!Number.isNaN(date.getTime())) {
        setInsightsLastSubmitted(date);
      }
    } catch {
      // Ignore malformed stored values — cooldown stays inactive.
    }
  }, [insightsStorageKey]);
  const insightsCooldownActive =
    insightsLastSubmitted !== null &&
    insightsNow - insightsLastSubmitted.getTime() < INSIGHTS_COOLDOWN_MS;
  const insightsTooltip =
    insightsCooldownActive && insightsLastSubmitted
      ? `${t('userMenu.insightsCooldownPrefix') as string}${new Date(insightsLastSubmitted.getTime() + INSIGHTS_COOLDOWN_MS).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : undefined;

  async function handleInsightsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: t('userMenu.insightsFileTooLarge') as string, detail: t('userMenu.insightsFileTooLargeDetail') as string, type: "error" });
      return;
    }

    setOpen(false);
    setToast({ message: t('userMenu.insightsProcessing') as string, type: "loading" });

    try {
      const html = await file.text();
      const { parseInsightsHtml } = await import("@/lib/insights/parser");
      const data = parseInsightsHtml(html);

      const uploadRes = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      setToast({ message: t('userMenu.insightsRecalculating') as string, type: "loading" });

      // Parse upload response and start recalculate in parallel
      const [uploadData, recalcRes] = await Promise.all([
        uploadRes.json(),
        fetch("/api/recalculate", { method: "POST" }),
      ]);

      const now = new Date();
      localStorage.setItem(insightsStorageKey, now.toISOString());
      setInsightsLastSubmitted(now);
      setInsightsNow(now.getTime());

      if (recalcRes.ok) {
        const recalcData = await recalcRes.json();
        const craftScore = uploadData.craftScore?.craftScore ?? recalcData.craftScore;
        const craftTier = uploadData.craftScore?.tier ?? recalcData.craftTier;
        const newScore = recalcData.adjustedComposite;

        setToast({
          message: `Craft: ${craftScore} ${craftTier}`,
          detail: `Score updated to ${newScore}`,
          type: "success",
        });
      } else {
        const craftScore = uploadData.craftScore?.craftScore;
        const craftTier = uploadData.craftScore?.tier;
        setToast({
          message: craftScore
            ? `Craft: ${craftScore} ${craftTier}`
            : t('userMenu.insightsImported') as string,
          detail: t('userMenu.insightsImportedDetail') as string,
          type: "success",
        });
      }

      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 2500);
    } catch {
      setToast({ message: t('userMenu.insightsImportFailed') as string, detail: t('userMenu.insightsImportFailedDetail') as string, type: "error" });
    }
  }

  useEffect(() => () => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (platformStatusStore.getSnapshot().fetched) {
      return;
    }
    // Only probe the status endpoint for platforms whose public feature flag is
    // enabled. When an integration is flag-gated OFF we skip the network call
    // entirely instead of relying on the server to answer `{ enabled: false }`,
    // avoiding wasted requests on every mount (#885). The server still has the
    // final say for enabled platforms.
    function fetchPlatformStatus(
      platform: "bitbucket" | "codeberg" | "gitlab",
      setter: typeof setBbStatus,
    ) {
      fireAndForget(
        () =>
          fetch(`/api/auth/${platform}/status`)
            .then((r) => r.json())
            .then((data) => {
              if (data.enabled) {
                const status = { linked: data.linked, remoteLogin: data.remoteLogin };
                platformStatusStore.getSnapshot()[platform] = status;
                setter(status);
              }
            }),
        () => undefined,
      ); // Graceful — menu works without status
    }
    if (isBitbucketEnabledSync()) fetchPlatformStatus("bitbucket", setBbStatus);
    if (isCodebergEnabledSync()) fetchPlatformStatus("codeberg", setCbStatus);
    if (isGitlabEnabledSync()) fetchPlatformStatus("gitlab", setGlStatus);
    platformStatusStore.getSnapshot().fetched = true;
  }, []);

  // Shared unlink flow — collapses the three near-identical platform disconnect
  // handlers into one parametrized helper (#884). Each named handler below
  // supplies only its platform-specific endpoint and state setters; the fetch,
  // success transition (cache clear + router refresh), graceful-failure, and
  // loading-state bookkeeping live here once.
  type PlatformStatusSetter = typeof setBbStatus;
  const unlinkPlatform = useCallback(
    async (config: {
      endpoint: string;
      setLoading: (loading: boolean) => void;
      setStatus: PlatformStatusSetter;
      setShowConfirm: (show: boolean) => void;
    }) => {
      const { endpoint, setLoading, setStatus, setShowConfirm } = config;
      setLoading(true);
      try {
        const res = await fetch(endpoint, { method: "POST" });
        if (res.ok) {
          clearPlatformStatusCache();
          setStatus({ linked: false, remoteLogin: null });
          setShowConfirm(false);
          router.refresh();
        }
      } catch {
        // Graceful failure — user can try again
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  async function handleUnlinkBitbucket() {
    await unlinkPlatform({
      endpoint: "/api/auth/bitbucket/disconnect",
      setLoading: setUnlinkLoading,
      setStatus: setBbStatus,
      setShowConfirm: setShowUnlinkConfirm,
    });
  }

  async function handleUnlinkCodeberg() {
    await unlinkPlatform({
      endpoint: "/api/auth/codeberg/disconnect",
      setLoading: setCbUnlinkLoading,
      setStatus: setCbStatus,
      setShowConfirm: setShowCbUnlinkConfirm,
    });
  }

  async function handleUnlinkGitlab() {
    await unlinkPlatform({
      endpoint: "/api/auth/gitlab/disconnect",
      setLoading: setGlUnlinkLoading,
      setStatus: setGlStatus,
      setShowConfirm: setShowGlUnlinkConfirm,
    });
  }

  async function handleSignOut() {
    // Clear all module-level per-user caches before navigating away.
    // This prevents the previous user's session, platform links, or
    // cache warm state from appearing when a different user logs in
    // in the same tab. (#732)
    clearSessionCache();
    clearPlatformStatusCache();
    clearCacheWarmState();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const fallbackLetter = login.charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('aria.userMenu') as string}
        className="flex items-center gap-2 rounded-full border border-stroke bg-card/60 px-1.5 py-1 transition-colors hover:border-amber/20 hover:bg-card"
      >
        {imgError ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber/10 text-sm font-semibold text-amber">
            {fallbackLetter}
          </div>
        ) : (
          <Image
            src={avatarUrl}
            alt={`${login}'s avatar`}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full img-outline"
            onError={() => setImgError(true)}
          />
        )}
        <span className="hidden text-sm text-text-primary sm:inline">
          {login}
        </span>
        <svg
          className={`h-4 w-4 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="menu"
          aria-label={t('aria.userMenuOptions') as string}
          className={`absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-card shadow-card ${dropdownExiting ? "animate-fade-out-up" : "animate-scale-in"}`}
        >
          {/* Header */}
          <div className="border-b border-stroke px-4 py-3">
            <div className="flex items-center gap-3">
              {imgError ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/10 text-base font-semibold text-amber">
                  {fallbackLetter}
                </div>
              ) : (
                <Image
                  src={avatarUrl}
                  alt={`${login}'s avatar`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full img-outline"
                  onError={() => setImgError(true)}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {name || login}
                </p>
                <p className="truncate text-xs text-text-secondary">
                  @{login}
                </p>
              </div>
            </div>
          </div>

          {/* My Badge + Creator Studio */}
          <div className="px-2 py-1.5">
            <Link
              href={`/u/${login}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
            >
              <GitHubIcon className="h-4 w-4 text-text-secondary" />
              {t('userMenu.myBadge') as string}
            </Link>
            {studioEnabled && (
              <Link
                href="/studio"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
              >
                <svg
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3l1.912 5.813h6.088l-4.956 3.574 1.912 5.813L12 14.626 7.044 18.2l1.912-5.813L4 8.813h6.088z" />
                </svg>
                {t('userMenu.creatorStudio') as string}
              </Link>
            )}
            {isInsightsEnabledSync() && (
              <button
                type="button"
                role="menuitem"
                disabled={insightsCooldownActive}
                title={insightsTooltip}
                onClick={() => insightsFileRef.current?.click()}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${insightsCooldownActive ? "cursor-not-allowed opacity-50 text-text-secondary" : "text-text-primary hover:bg-amber/[0.06]"}`}
              >
                <svg
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t('userMenu.importInsights') as string}
                <input
                  ref={insightsFileRef}
                  type="file"
                  accept=".html"
                  onChange={handleInsightsFile}
                  className="sr-only"
                  aria-label={t('aria.selectInsightsReport') as string}
                />
              </button>
            )}
            {bbStatus && (
              bbStatus.linked ? (
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
                  <a
                    href={`https://bitbucket.org/${bbStatus.remoteLogin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 transition-colors hover:text-amber"
                  >
                    <BitbucketIcon className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">{bbStatus.remoteLogin}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowUnlinkConfirm(true)}
                    aria-label={t('aria.unlinkBitbucket') as string}
                    className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
                  >
                    {t('userMenu.unlinkBtn') as string}
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/bitbucket/connect"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
                >
                  <BitbucketIcon width={16} height={16} />
                  {t('userMenu.linkBitbucket') as string}
                </a>
              )
            )}
            {cbStatus && (
              cbStatus.linked ? (
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
                  <a
                    href={`https://codeberg.org/${cbStatus.remoteLogin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 transition-colors hover:text-amber"
                  >
                    <CodebergIcon className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">{cbStatus.remoteLogin}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowCbUnlinkConfirm(true)}
                    aria-label={t('aria.unlinkCodeberg') as string}
                    className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
                  >
                    {t('userMenu.unlinkBtn') as string}
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/codeberg/connect"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
                >
                  <CodebergIcon className="h-4 w-4 text-text-secondary" />
                  {t('userMenu.linkCodeberg') as string}
                </a>
              )
            )}
            {glStatus && (
              glStatus.linked ? (
                <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
                  <a
                    href={`https://gitlab.com/${glStatus.remoteLogin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 transition-colors hover:text-amber"
                  >
                    <GitlabIcon className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">{glStatus.remoteLogin}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowGlUnlinkConfirm(true)}
                    aria-label={t('aria.unlinkGitlab') as string}
                    className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
                  >
                    {t('userMenu.unlinkBtn') as string}
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/gitlab/connect"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
                >
                  <GitlabIcon className="h-4 w-4 text-text-secondary" />
                  {t('userMenu.linkGitlab') as string}
                </a>
              )
            )}
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-amber/[0.06]"
              >
                <svg
                  className="h-4 w-4 text-text-secondary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t('userMenu.adminPanel') as string}
              </Link>
            )}
          </div>

          <div className="mx-3 border-t border-stroke" />

          {/* Links */}
          <div className="px-2 py-1.5">
            <Link
              href="/about"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              {t('userMenu.aboutChapa') as string}
            </Link>
            <Link
              href="/terms"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              {t('userMenu.termsOfService') as string}
            </Link>
            <Link
              href="/privacy"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t('userMenu.privacyPolicy') as string}
            </Link>
          </div>

          <div className="mx-3 border-t border-stroke" />

          {/* Sign out */}
          <div className="px-2 py-1.5">
            <form method="POST" action="/api/auth/logout" onSubmit={(e) => { e.preventDefault(); void handleSignOut(); }}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                {t('userMenu.signOut') as string}
              </button>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showUnlinkConfirm}
        title={t('userMenu.confirmUnlinkBitbucketTitle') as string}
        description={t('userMenu.confirmUnlinkBitbucketBody') as string}
        confirmLabel={t('userMenu.confirmBtn') as string}
        cancelLabel={t('userMenu.cancelBtn') as string}
        variant="destructive"
        loading={unlinkLoading}
        onConfirm={handleUnlinkBitbucket}
        onCancel={() => setShowUnlinkConfirm(false)}
      />
      <ConfirmDialog
        open={showCbUnlinkConfirm}
        title={t('userMenu.confirmUnlinkCodebergTitle') as string}
        description={t('userMenu.confirmUnlinkCodebergBody') as string}
        confirmLabel={t('userMenu.confirmBtn') as string}
        cancelLabel={t('userMenu.cancelBtn') as string}
        variant="destructive"
        loading={cbUnlinkLoading}
        onConfirm={handleUnlinkCodeberg}
        onCancel={() => setShowCbUnlinkConfirm(false)}
      />
      <ConfirmDialog
        open={showGlUnlinkConfirm}
        title={t('userMenu.confirmUnlinkGitlabTitle') as string}
        description={t('userMenu.confirmUnlinkGitlabBody') as string}
        confirmLabel={t('userMenu.confirmBtn') as string}
        cancelLabel={t('userMenu.cancelBtn') as string}
        variant="destructive"
        loading={glUnlinkLoading}
        onConfirm={handleUnlinkGitlab}
        onCancel={() => setShowGlUnlinkConfirm(false)}
      />
      {toast && (
        <Toast
          message={toast.message}
          detail={toast.detail}
          type={toast.type}
          duration={toast.type === "loading" ? 0 : toast.type === "error" ? 5000 : 4000}
          onDismiss={handleToastDismiss}
        />
      )}
    </div>
  );
}

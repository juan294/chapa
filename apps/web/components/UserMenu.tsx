"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { isStudioEnabledSync, isInsightsEnabledSync } from "@/lib/feature-flags";
import { clearSessionCache } from "@/hooks/useSession";
import { clearCacheWarmState } from "@/hooks/useOwnerCacheWarm";
import { useDropdownMenu } from "@/hooks/useDropdownMenu";
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";
import { ConfirmDialog } from "./ConfirmDialog";
import { Toast } from "./Toast";

/** Module-level cache for platform status fetches — persists across mounts */
const platformStatusCache: {
  fetched: boolean;
  bitbucket: { linked: boolean; remoteLogin: string | null } | null;
  codeberg: { linked: boolean; remoteLogin: string | null } | null;
} = {
  fetched: false,
  bitbucket: null,
  codeberg: null,
};

/** Clear the platform status cache — call after link/unlink actions */
export function clearPlatformStatusCache() {
  platformStatusCache.fetched = false;
  platformStatusCache.bitbucket = null;
  platformStatusCache.codeberg = null;
}

interface UserMenuProps {
  login: string;
  name: string | null;
  avatarUrl: string;
  isAdmin?: boolean;
}

export function UserMenu({ login, name, avatarUrl, isAdmin }: UserMenuProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isOpen: open, setIsOpen: setOpen } = useDropdownMenu(menuRef);
  const { shouldRender: showDropdown, isAnimatingOut: dropdownExiting } =
    useAnimatedUnmount(open, 200);

  const [bbStatus, setBbStatus] = useState<{
    linked: boolean;
    remoteLogin: string | null;
  } | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  const [cbStatus, setCbStatus] = useState<{
    linked: boolean;
    remoteLogin: string | null;
  } | null>(null);
  const [showCbUnlinkConfirm, setShowCbUnlinkConfirm] = useState(false);
  const [cbUnlinkLoading, setCbUnlinkLoading] = useState(false);

  // Insights import — file picker triggered directly from menu
  const insightsFileRef = useRef<HTMLInputElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleToastDismiss = useCallback(() => setToast(null), []);
  const [toast, setToast] = useState<{
    message: string;
    detail?: string;
    type: "loading" | "success" | "error" | "info";
  } | null>(null);

  // Insights cooldown — read last-submitted timestamp from localStorage on mount
  const INSIGHTS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
  const insightsStorageKey = `chapa_insights_last_submitted_${login}`;
  const [insightsLastSubmitted, setInsightsLastSubmitted] = useState<Date | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(insightsStorageKey);
    if (stored) {
      const date = new Date(stored);
      if (!isNaN(date.getTime())) setInsightsLastSubmitted(date);
    }
  }, [insightsStorageKey]);
  const insightsCooldownActive =
    insightsLastSubmitted !== null &&
    Date.now() - insightsLastSubmitted.getTime() < INSIGHTS_COOLDOWN_MS;
  const insightsTooltip =
    insightsCooldownActive && insightsLastSubmitted
      ? `Available again on ${new Date(insightsLastSubmitted.getTime() + INSIGHTS_COOLDOWN_MS).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : undefined;

  async function handleInsightsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 10 * 1024 * 1024) {
      setToast({ message: "File too large", detail: "Maximum size is 10 MB", type: "error" });
      return;
    }

    setOpen(false);
    setToast({ message: "Processing report…", type: "loading" });

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

      setToast({ message: "Recalculating score…", type: "loading" });

      // Parse upload response and start recalculate in parallel
      const [uploadData, recalcRes] = await Promise.all([
        uploadRes.json(),
        fetch("/api/recalculate", { method: "POST" }),
      ]);

      const now = new Date();
      localStorage.setItem(insightsStorageKey, now.toISOString());
      setInsightsLastSubmitted(now);

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
            : "Insights uploaded",
          detail: "Score will update on next badge view",
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
      setToast({ message: "Import failed", detail: "Please try again", type: "error" });
    }
  }

  useEffect(() => () => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (platformStatusCache.fetched) {
      if (platformStatusCache.bitbucket) setBbStatus(platformStatusCache.bitbucket);
      if (platformStatusCache.codeberg) setCbStatus(platformStatusCache.codeberg);
      return;
    }
    // Server returns { enabled: false } if flag is off — no client-side
    // sync flag checks needed. Fixes #632.
    function fetchPlatformStatus(
      platform: "bitbucket" | "codeberg",
      setter: typeof setBbStatus,
    ) {
      fetch(`/api/auth/${platform}/status`)
        .then((r) => r.json())
        .then((data) => {
          if (data.enabled) {
            const status = { linked: data.linked, remoteLogin: data.remoteLogin };
            platformStatusCache[platform] = status;
            setter(status);
          }
        })
        .catch(() => {}); // Graceful — menu works without status
    }
    fetchPlatformStatus("bitbucket", setBbStatus);
    fetchPlatformStatus("codeberg", setCbStatus);
    platformStatusCache.fetched = true;
  }, []);

  async function handleUnlinkBitbucket() {
    setUnlinkLoading(true);
    try {
      const res = await fetch("/api/auth/bitbucket/disconnect", { method: "POST" });
      if (res.ok) {
        clearPlatformStatusCache();
        setBbStatus({ linked: false, remoteLogin: null });
        setShowUnlinkConfirm(false);
        router.refresh();
      }
    } catch {
      // Graceful failure — user can try again
    } finally {
      setUnlinkLoading(false);
    }
  }

  async function handleUnlinkCodeberg() {
    setCbUnlinkLoading(true);
    try {
      const res = await fetch("/api/auth/codeberg/disconnect", { method: "POST" });
      if (res.ok) {
        clearPlatformStatusCache();
        setCbStatus({ linked: false, remoteLogin: null });
        setShowCbUnlinkConfirm(false);
        router.refresh();
      }
    } catch {
      // Graceful failure
    } finally {
      setCbUnlinkLoading(false);
    }
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
        aria-label="User menu"
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
          aria-label="User menu options"
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
              <svg
                className="h-4 w-4 text-text-secondary"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              My Badge
            </Link>
            {isStudioEnabledSync() && (
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
                Creator Studio
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
                Import Claude Code Insights
                <input
                  ref={insightsFileRef}
                  type="file"
                  accept=".html"
                  onChange={handleInsightsFile}
                  className="sr-only"
                  aria-label="Select Claude Code insights HTML report"
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
                    <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
                    </svg>
                    <span className="text-sm text-text-primary">{bbStatus.remoteLogin}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowUnlinkConfirm(true)}
                    aria-label="Unlink Bitbucket account"
                    className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/bitbucket/connect"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
                  </svg>
                  Link Bitbucket
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
                    <CodebergIcon />
                    <span className="text-sm text-text-primary">{cbStatus.remoteLogin}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowCbUnlinkConfirm(true)}
                    aria-label="Unlink Codeberg account"
                    className="text-xs text-text-secondary transition-colors hover:text-terminal-red"
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <a
                  href="/api/auth/codeberg/connect"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-amber/[0.06] hover:text-text-primary"
                >
                  <CodebergIcon />
                  Link Codeberg
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
                Admin Panel
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
              About Chapa
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
              Terms of Service
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
              Privacy Policy
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
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showUnlinkConfirm}
        title="Unlink Bitbucket?"
        description="Your Bitbucket stats will no longer be included in your impact score. You can re-link anytime."
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="destructive"
        loading={unlinkLoading}
        onConfirm={handleUnlinkBitbucket}
        onCancel={() => setShowUnlinkConfirm(false)}
      />
      <ConfirmDialog
        open={showCbUnlinkConfirm}
        title="Unlink Codeberg?"
        description="Your Codeberg stats will no longer be included in your impact score. You can re-link anytime."
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="destructive"
        loading={cbUnlinkLoading}
        onConfirm={handleUnlinkCodeberg}
        onCancel={() => setShowCbUnlinkConfirm(false)}
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

function CodebergIcon() {
  return (
    <svg className="h-4 w-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.373L11.838 5.928a.187.187 0 0 1 .324 0l10.006 12.935A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12 12 12 0 0 0-.045 0zm.375 6.467l4.416 5.774-4.416 3.252-4.416-3.252z" />
    </svg>
  );
}

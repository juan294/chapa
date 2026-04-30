"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/posthog";
import { useDropdownMenu } from "@/hooks/useDropdownMenu";
import { useAnimatedUnmount } from "@/hooks/useAnimatedUnmount";
import { useSession } from "@/hooks/useSession";

interface BadgeToolbarProps {
  handle: string;
}

export function BadgeToolbar({
  handle,
}: BadgeToolbarProps) {
  const router = useRouter();
  const { session } = useSession();
  const isOwner = session?.login === handle;
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const shareRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);
  const { isOpen: shareOpen, setIsOpen: setShareOpen } = useDropdownMenu(shareRef);
  const { shouldRender: showShare, isAnimatingOut: shareExiting } =
    useAnimatedUnmount(shareOpen, 200);

  async function handleRefresh() {
    setRefreshStatus("loading");
    try {
      const res = await fetch(
        `/api/refresh?handle=${encodeURIComponent(handle)}`,
        { method: "POST" },
      );
      if (res.ok) {
        setRefreshStatus("success");
        setTimeout(() => router.refresh(), 500);
      } else {
        setRefreshStatus("error");
        setTimeout(() => setRefreshStatus("idle"), 3000);
      }
    } catch {
      setRefreshStatus("error");
      setTimeout(() => setRefreshStatus("idle"), 3000);
    }
  }

  const [copied, setCopied] = useState(false);

  const shareUrl = `https://chapa.thecreativetoken.com/u/${handle}`;
  const tweetText = encodeURIComponent(
    `Just decoded my developer impact on Chapa. Curious what yours looks like?\n\nDiscover your coding DNA \u2192 ${shareUrl}`,
  );
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const blueskyUrl = `https://bsky.app/intent/compose?text=${tweetText}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent("share_clicked", { platform: "copy_link" });
      setShareOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may be blocked */
    }
  }, [shareUrl, setShareOpen]);

  const [downloadStatus, setDownloadStatus] = useState<"idle" | "loading">("idle");

  const handleDownload = useCallback(async () => {
    setDownloadStatus("loading");
    trackEvent("badge_downloaded", { handle });
    try {
      const res = await fetch(`/u/${encodeURIComponent(handle)}/badge.svg`);
      if (!res.ok) throw new Error("fetch failed");
      let svgText = await res.text();

      // Strip all animations for static PNG rendering:
      // 1. CSS @keyframes blocks
      svgText = svgText.replace(/@keyframes[^}]*\{[^}]*\{[^}]*\}[^}]*\}/g, "");
      // 2. CSS animation properties in style attributes
      svgText = svgText.replace(/animation[^;"]*/g, "");
      // 3. SMIL <animate> elements (heatmap fade-in uses these)
      svgText = svgText.replace(/<animate [^>]*\/>/g, "");
      svgText = svgText.replace(/<animate [^>]*>[^<]*<\/animate>/g, "");
      // 4. Set heatmap rects to fully visible (they start at opacity="0")
      svgText = svgText.replace(/opacity="0"/g, 'opacity="1"');

      // Use data URI (more reliable than blob URL for SVG→canvas)
      const scale = 2;
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
      const img = new Image();
      img.width = 1200;
      img.height = 630;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1200 * scale;
          canvas.height = 630 * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("no canvas context")); return; }
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, 1200, 630);

          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("toBlob failed")); return; }
            const pngUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = pngUrl;
            a.download = `chapa-${handle}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(pngUrl);
            resolve();
          }, "image/png");
        };
        img.onerror = () => reject(new Error("img load failed"));
        img.src = dataUri;
      });
    } catch {
      // Fallback: download SVG directly if PNG conversion fails
      const a = document.createElement("a");
      a.href = `/u/${encodeURIComponent(handle)}/badge.svg`;
      a.download = `chapa-${handle}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      if (mountedRef.current) {
        setDownloadStatus("idle");
      }
    }
  }, [handle]);

  const btnClass =
    "inline-flex items-center justify-center gap-1.5 rounded-lg min-h-[44px] min-w-[44px] px-2 sm:px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-amber/[0.06] focus-visible:text-text-primary focus-visible:bg-amber/[0.06] transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Refresh (owner only) */}
      {isOwner && (
        <button
          onClick={handleRefresh}
          disabled={refreshStatus === "loading" || refreshStatus === "success"}
          aria-busy={refreshStatus === "loading"}
          title={
            refreshStatus === "idle"
              ? "Refresh badge data"
              : refreshStatus === "loading"
                ? "Refreshing\u2026"
                : refreshStatus === "success"
                  ? "Refreshed!"
                  : "Failed \u2014 try again"
          }
          aria-label="Refresh badge data"
          className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <svg
            className={`w-3.5 h-3.5 ${refreshStatus === "loading" ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {refreshStatus === "idle" && "Refresh"}
          {refreshStatus === "loading" && "Refreshing\u2026"}
          {refreshStatus === "success" && "Refreshed!"}
          {refreshStatus === "error" && "Failed"}
        </button>
      )}

      {/* Share dropdown */}
      <div className="relative" ref={shareRef}>
        <button
          onClick={() => setShareOpen(!shareOpen)}
          aria-expanded={shareOpen}
          aria-haspopup="true"
          aria-label="Share badge"
          className={btnClass}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>

        {showShare && (
          <div
            className={`absolute top-full right-0 sm:left-0 sm:right-auto mt-2 min-w-[140px] rounded-xl bg-card shadow-card p-1.5 z-20 ${shareExiting ? "animate-fade-out-up" : "animate-terminal-fade-in"}`}
            role="menu"
            aria-label="Share options"
          >
            <a
              href={`https://x.com/intent/tweet?text=${tweetText}`}
              onClick={() => {
                trackEvent("share_clicked", { platform: "x" });
                setShareOpen(false);
              }}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
            >
              Post on
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={linkedinUrl}
              onClick={() => {
                trackEvent("share_clicked", { platform: "linkedin" });
                setShareOpen(false);
              }}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
            >
              Share on
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href={blueskyUrl}
              onClick={() => {
                trackEvent("share_clicked", { platform: "bluesky" });
                setShareOpen(false);
              }}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors"
            >
              Post on
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 360 320"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M254.896 184.158C252.81 166.601 250.856 155.293 235.434 131.079C220.872 108.166 190.835 80.0884 180.137 72.3609C169.439 80.0884 139.402 108.166 124.84 131.079C109.418 155.293 107.464 166.601 105.378 184.158C103.007 204.236 109.985 228.883 130.418 233.751C147.255 237.737 162.419 227.215 174.654 210.803C175.988 208.958 180.137 202.59 180.137 202.59C180.137 202.59 184.286 208.958 185.62 210.803C197.855 227.215 213.019 237.737 229.856 233.751C250.289 228.883 257.267 204.236 254.896 184.158Z" />
                <path d="M180.86 0.608013C136.772 36.9693 89.1498 95.3506 65.9156 136.53C54.5997 156.469 28.8577 202.645 33.6492 255.207C37.9015 301.762 60.9302 317.649 91.3786 318.987C133.674 320.832 160.432 290.132 180.86 257.876C201.288 290.132 228.046 320.832 270.342 318.987C300.79 317.649 323.819 301.762 328.071 255.207C332.862 202.645 307.12 156.469 295.805 136.53C272.57 95.3506 224.948 36.9693 180.86 0.608013Z" />
              </svg>
            </a>
            <button
              onClick={handleCopyLink}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-amber/10 hover:text-text-primary transition-colors w-full"
            >
              {copied ? "Copied!" : "Copy link"}
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {copied ? (
                  <path d="M20 6L9 17l-5-5" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Download PNG */}
      <button
        onClick={handleDownload}
        disabled={downloadStatus === "loading"}
        aria-busy={downloadStatus === "loading"}
        aria-label="Download badge as PNG"
        className={`${btnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {downloadStatus === "loading" ? "Downloading\u2026" : "Download"}
      </button>

    </div>
  );
}

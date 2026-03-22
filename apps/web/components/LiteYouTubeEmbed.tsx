"use client";

import { useState } from "react";

interface LiteYouTubeEmbedProps {
  /** YouTube video ID (the part after v= in the URL) */
  videoId: string;
  /** Accessible title for the iframe and play button */
  title: string;
}

/**
 * Lightweight YouTube embed — renders a thumbnail + play button.
 * Only loads the heavy YouTube iframe when the user clicks play.
 * This keeps the page fast (avoids ~800KB iframe on initial load).
 */
export function LiteYouTubeEmbed({ videoId, title }: LiteYouTubeEmbedProps) {
  const [activated, setActivated] = useState(false);

  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : undefined;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-stroke bg-card">
      {activated ? (
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          aria-label={`Play ${title}`}
          onClick={() => setActivated(true)}
          className="group relative h-full w-full cursor-pointer"
        >
          {thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, shown briefly before iframe loads */
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-dark-section">
              <span className="font-heading text-sm text-text-secondary">
                Video coming soon
              </span>
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber/90 shadow-lg shadow-amber/25 transition-transform group-hover:scale-110">
              <svg
                viewBox="0 0 24 24"
                fill="white"
                className="ml-1 h-7 w-7"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

// ----------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------

/** The "home" text shown by default in the pill. */
const HOME_TEXT = "</> JG";

/** Rotating messages that cycle after the initial hold period. */
const MESSAGES = [
  HOME_TEXT,
  "built with \u2665 in the EU",
  "built by Creative Tokens",
  "probably \ud83c\udfd4\ufe0f rn",
  "probably \ud83d\udeb4 rn",
  "404: sleep not found",
  "works on my machine\u2122",
  "bug-free* (*mostly)",
  "git push --pray",
  "// TODO: fix later",
  "it compiled, ship it",
  "powered by Son of Anton",
];

/** Social links shown in the hover popover. Set to [] to hide the popover. */
const SOCIAL_LINKS: { href: string; label: string; svgPath: string }[] = [
  {
    href: "https://x.com/JuanG294",
    label: "X (Twitter)",
    svgPath:
      "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    href: "https://www.linkedin.com/in/juanagonzalezp/",
    label: "LinkedIn",
    svgPath:
      "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    href: "https://medium.com/@juang294",
    label: "Medium",
    svgPath:
      "M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z",
  },
  {
    href: "https://github.com/juan294",
    label: "GitHub",
    svgPath:
      "M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z",
  },
];

/** Author name shown in the popover above the social links. */
const AUTHOR_NAME = "Juan Gonz\u00e1lez";

// ----------------------------------------------------------------
// Timing constants (ms)
// ----------------------------------------------------------------
const CHAR_DELAY = 80;
const EMPTY_PAUSE = 300;
const HOME_HOLD = 30_000;
const MSG_HOLD = 4_000;

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

interface AuthorTypewriterProps {
  className?: string;
}

export function AuthorTypewriter({ className }: AuthorTypewriterProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion.current) return;
    if (!textRef.current) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let messageIndex = 0;

    const setText = (text: string) => {
      if (textRef.current) textRef.current.textContent = text;
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          if (!cancelled) resolve();
        }, ms);
      });

    const eraseText = async (text: string) => {
      for (let i = text.length; i >= 0; i--) {
        if (cancelled) return;
        setText(text.slice(0, i));
        if (i > 0) await wait(CHAR_DELAY);
      }
    };

    const typeText = async (text: string) => {
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return;
        setText(text.slice(0, i));
        if (i < text.length) await wait(CHAR_DELAY);
      }
    };

    const cycle = async () => {
      setText(HOME_TEXT);
      await wait(HOME_HOLD);

      while (!cancelled) {
        messageIndex = (messageIndex + 1) % MESSAGES.length;
        if (messageIndex === 0) messageIndex = 1;

        const nextMsg = MESSAGES[messageIndex]!;

        await eraseText(HOME_TEXT);
        if (cancelled) return;
        await wait(EMPTY_PAUSE);
        if (cancelled) return;
        await typeText(nextMsg);
        if (cancelled) return;
        await wait(MSG_HOLD);
        if (cancelled) return;
        await eraseText(nextMsg);
        if (cancelled) return;
        await wait(EMPTY_PAUSE);
        if (cancelled) return;
        await typeText(HOME_TEXT);
        if (cancelled) return;
        await wait(HOME_HOLD);
      }
    };

    cycle();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className={`group relative z-20 transition-opacity duration-500 ${className ?? ""}`}
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
    >
      {/* Popover card — appears above the pill on hover */}
      {SOCIAL_LINKS.length > 0 && (
        <div className="absolute bottom-full right-0 pb-2 opacity-0 translate-y-2 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:pointer-events-auto transition-all duration-200 ease-[cubic-bezier(0.65,0,0.35,1)]">
          <div className="p-3 rounded-xl bg-card/90 backdrop-blur-xl border border-stroke">
            <p className="text-[11px] text-text-secondary font-medium whitespace-nowrap mb-2 select-none">
              {AUTHOR_NAME}
            </p>
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-amber/10 text-text-secondary hover:text-amber hover:bg-amber/20 transition-all duration-200"
                  aria-label={link.label}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d={link.svgPath} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trigger pill — terminal typewriter */}
      <button
        type="button"
        className="flex items-center h-6 min-w-[3.5rem] px-2.5 rounded-full bg-amber/10 hover:bg-amber/15 backdrop-blur-sm cursor-default transition-all duration-150 border border-stroke"
        aria-label={`Made by ${AUTHOR_NAME}`}
      >
        <span className="text-[10px] font-heading text-text-secondary group-hover:text-text-primary transition-colors duration-300 select-none whitespace-nowrap">
          <span ref={textRef}>{HOME_TEXT}</span>
          <span
            className="text-amber/40 ml-px animate-cursor-blink"
            aria-hidden="true"
          >
            &#9612;
          </span>
        </span>
      </button>
    </div>
  );
}

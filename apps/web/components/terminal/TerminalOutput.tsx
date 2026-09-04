"use client";

import { useEffect, useRef } from "react";
import type { OutputLine } from "./command-registry";
import { useTranslation } from "@/lib/i18n";

interface TerminalOutputProps {
  lines: OutputLine[];
}

const TYPE_STYLES: Record<string, string> = {
  input: "text-amber",
  success: "text-terminal-green",
  error: "text-terminal-red",
  warning: "text-terminal-yellow",
  system: "text-text-secondary",
  info: "text-text-primary",
  dim: "text-terminal-dim",
};

const TYPE_PREFIX: Record<string, string> = {
  input: "> ",
  success: "  ",
  error: "! ",
  warning: "~ ",
  system: "$ ",
  info: "  ",
  dim: "  ",
};

/**
 * Scroll the log to its latest line by moving only the nearest scrolling
 * ancestor, never the window.
 *
 * This used to be `scrollIntoView` on a sentinel after the last line, and
 * `scrollIntoView` scrolls EVERY scrollable ancestor it needs to, the page
 * included. In Studio each command appends output, so each click on a control
 * dragged the whole page down to the log's tail and the badge preview out of
 * view; the user had to scroll back up to see the effect they had just
 * applied, then down again for the next one. Both consumers (Studio's session
 * column and `GlobalCommandBar`) wrap the log in their own `overflow-y-auto`
 * box, so that box is the scroller to move. The walk stops at `<body>`: if no
 * bounded ancestor exists the log simply does not auto-scroll.
 */
export function scrollLogToEnd(
  start: HTMLElement | null,
  behavior: ScrollBehavior = "smooth",
): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    const overflowY = getComputedStyle(el).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    ) {
      if (typeof el.scrollTo === "function") {
        el.scrollTo({ top: el.scrollHeight, behavior });
      } else {
        el.scrollTop = el.scrollHeight;
      }
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function TerminalOutput({ lines }: TerminalOutputProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollLogToEnd(rootRef.current);
  }, [lines.length]);

  return (
    <div
      ref={rootRef}
      role="log"
      aria-live="polite"
      aria-label={t("aria.terminalOutput") as string}
      className="flex-1 overflow-y-auto font-terminal text-sm leading-relaxed p-4 space-y-0.5"
    >
      {lines.map((line) => (
        <div
          key={line.id}
          className={`${TYPE_STYLES[line.type] ?? "text-text-primary"} animate-terminal-fade-in whitespace-pre-wrap break-words`}
        >
          <span className="text-terminal-dim select-none">
            {TYPE_PREFIX[line.type] ?? "  "}
          </span>
          {line.text}
        </div>
      ))}
    </div>
  );
}

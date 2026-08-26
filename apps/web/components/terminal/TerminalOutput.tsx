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

export function TerminalOutput({ lines }: TerminalOutputProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div
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
      <div ref={bottomRef} />
    </div>
  );
}

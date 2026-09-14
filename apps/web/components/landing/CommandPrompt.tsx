"use client";
import type { ReactNode } from "react";

/** A section's visible command fills the one existing terminal without executing it. */
export function CommandPrompt({command, children, className = ""}: {command: string; children?: ReactNode; className?: string}) {
  return <button type="button" className={`min-h-11 font-terminal text-xs ${className}`} onClick={() => window.dispatchEvent(new CustomEvent("chapa:terminal-fill", {detail: {value: command}}))}>{children ?? command}</button>;
}

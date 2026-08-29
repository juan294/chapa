import type { ReactNode } from "react";

export interface ContentPageHeaderProps {
  /** The command, without the `%` prefix. For example `chapa explain --scoring`. */
  command: string;
  /** Accepts a node so a page can highlight part of its own title. */
  title: ReactNode;
  intro?: ReactNode;
}

/**
 * The header every long-form content route opens with (#1218): the terminal
 * marker, the page title, and a one-paragraph orientation. It replaces a bare
 * h1 with a blinking cursor, which gave the reader a title and nothing else.
 */
export function ContentPageHeader({
  command,
  title,
  intro,
}: ContentPageHeaderProps) {
  return (
    <header className="mb-10">
      <div className="font-heading text-sm whitespace-nowrap text-text-secondary">
        <span className="select-none text-amber">%</span> {command}
      </div>
      <h1 className="mt-4 font-heading text-[clamp(1.875rem,6cqi,2.75rem)] leading-tight font-bold tracking-tight text-balance">
        {title}
        <span className="animate-cursor-blink text-amber">_</span>
      </h1>
      {intro && (
        <p className="mt-4 text-lg text-pretty text-text-secondary">{intro}</p>
      )}
    </header>
  );
}

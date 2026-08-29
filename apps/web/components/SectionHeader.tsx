import type { ReactNode } from "react";

export interface SectionHeaderProps {
  /** The command, without the `%` prefix. For example `chapa features`. */
  command: string;
  /** Right-aligned meta, e.g. "exit 0 · 5 results". */
  meta?: ReactNode;
  /** Rendered as the accessible heading for the section. */
  title?: string;
  className?: string;
}

/**
 * The v2 section header (#1214): a `% chapa <command>` marker on the left, a
 * right-aligned meta readout, and a rule underneath. It replaces the
 * free-standing `$ chapa x` line the landing page used, which carried no
 * status and left every section header looking like an unfinished prompt.
 *
 * Both spans are `whitespace-nowrap`: the pair is a single line of terminal
 * output, and wrapping either half breaks the reading of it. The row wraps as
 * a whole instead when the container is too narrow.
 *
 * `title` is rendered visually hidden. The marker is the visible heading, but
 * "% chapa features" is a poor document outline entry, so the real section
 * name is what lands in the accessibility tree.
 */
export function SectionHeader({
  command,
  meta,
  title,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stroke-strong pb-3 ${className}`}
    >
      {title && <h2 className="sr-only">{title}</h2>}
      <span className="font-heading text-sm whitespace-nowrap text-text-primary">
        <span className="select-none text-amber">%</span> {command}
      </span>
      {meta && (
        <span className="font-heading text-xs whitespace-nowrap text-terminal-dim">
          {meta}
        </span>
      )}
    </div>
  );
}

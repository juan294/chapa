interface DeltaIndicatorProps {
  /** The numeric change (positive, negative, or zero) */
  delta: number;
  /** Optional suffix label, e.g. "vs last week" */
  label?: string;
  /** Size variant — "sm" (default) or "md" */
  size?: "sm" | "md";
}

function formatDelta(delta: number): string {
  const abs = Math.abs(delta);
  // If the value has a meaningful fractional part, show 1 decimal
  const formatted = abs % 1 !== 0 ? abs.toFixed(1) : String(Math.round(abs));
  return delta >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function DeltaIndicator({
  delta,
  label,
  size = "sm",
}: DeltaIndicatorProps) {
  const isPositive = delta >= 0.5;
  const isNegative = delta <= -0.5;
  const isUnchanged = !isPositive && !isNegative;

  const arrow = isPositive ? "\u2191" : isNegative ? "\u2193" : "\u2192";
  const displayValue = isUnchanged ? "\u2014" : formatDelta(delta);

  const colorClass = isPositive
    ? "text-terminal-green"
    : isNegative
      ? "text-terminal-red"
      : "text-text-secondary";

  const sizeClass = size === "md" ? "text-sm" : "text-xs";

  const ariaLabel = isUnchanged
    ? "Score unchanged"
    : `Score changed by ${formatDelta(delta)} points`;

  return (
    <span
      className={`inline-flex items-center gap-1 ${colorClass} ${sizeClass}`}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true">{arrow}</span>
      <span className="font-heading tabular-nums">{displayValue}</span>
      {label && <span className="font-body">{label}</span>}
    </span>
  );
}

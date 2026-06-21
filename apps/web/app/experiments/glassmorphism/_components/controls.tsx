/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-amber" : "bg-warm-stroke"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-warm-bg transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Slider                                                             */
/* ------------------------------------------------------------------ */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-text-secondary">
        {label}:{" "}
        <span className="font-heading text-amber">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-warm-stroke accent-amber"
      />
      <div className="flex justify-between text-xs text-text-secondary">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Impact Breakdown Stat Card                                         */
/* ------------------------------------------------------------------ */
export function StatCard({
  label,
  value,
  maxValue,
  detail,
  style,
}: {
  label: string;
  value: number;
  maxValue: number;
  detail: string;
  style: React.CSSProperties;
}) {
  const pct = Math.round((value / maxValue) * 100);
  return (
    <div className="rounded-2xl p-5" style={style}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="font-heading text-lg font-bold text-amber">{value}</span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-bg/60">
        <div
          className="h-full rounded-full bg-amber/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-text-secondary leading-relaxed">{detail}</p>
    </div>
  );
}

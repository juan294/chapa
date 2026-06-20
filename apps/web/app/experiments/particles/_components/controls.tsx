/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */

export function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors ${
            checked ? "bg-amber" : "bg-stroke"
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-text-primary transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Row                                                         */
/* ------------------------------------------------------------------ */

export function DetailRow({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-heading text-sm font-bold text-amber mb-1">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed font-body">
        {text}
      </p>
    </div>
  );
}

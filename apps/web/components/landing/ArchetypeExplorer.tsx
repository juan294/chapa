"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export interface ArchetypeItem {
  id: string;
  label: string;
  description: string;
  glyph: string;
  dimensions: { label: string; value: number }[];
}

export function ArchetypeExplorer({ items, label, guideLabel, sampleLabel }: {
  items: ArchetypeItem[]; label: string; guideLabel: string; sampleLabel: string;
}) {
  const [selected, setSelected] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();
  useEffect(() => {
    const select = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return;
      setSelected(index);
      root.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
    };
    window.addEventListener("chapa:landing-archetype", select);
    return () => window.removeEventListener("chapa:landing-archetype", select);
  }, [items]);
  const active = items[selected] ?? items[0];
  if (!active) return null;
  return (
    <div ref={root} className="scroll-mt-28">
      <div role="tablist" aria-label={label} className="flex flex-wrap border-b border-text-primary">
        {items.map((item, index) => (
          <button key={item.id} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab"
            id={`${uid}-tab-${item.id}`} aria-controls={`${uid}-panel`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)} onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % items.length
                : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
                  : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
              if (next === null) return;
              event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
            }}
            className={`min-h-11 flex-grow border border-transparent px-3 py-4 text-left font-heading text-xs transition-colors focus-visible:outline-identity-text! ${selected === index ? "border-text-primary bg-card text-text-primary" : "text-identity-text hover:bg-identity-text/10"}`}>
            <span className="mr-2 tabular-nums">{String(index + 1).padStart(2, "0")}</span>{item.label}
          </button>
        ))}
      </div>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${active.id}`} className="grid border border-t-0 border-text-primary bg-card text-text-primary md:grid-cols-[.8fr_1.2fr]">
        <div className="relative flex min-h-64 items-center justify-center overflow-hidden border-b border-stroke bg-purple-tint md:border-r md:border-b-0">
          <span aria-hidden="true" className="font-display text-[clamp(10rem,25vw,22rem)] leading-none text-amber-text">{active.glyph}</span>
          <span className="absolute top-5 left-5 font-heading text-xs">CHAPA / {String(selected + 1).padStart(2, "0")}</span>
        </div>
        <div className="p-6 sm:p-10">
          <h3 className="font-display text-[clamp(2.6rem,6vw,5rem)] font-bold uppercase leading-none">{active.label}</h3>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary">{active.description}</p>
          <dl className="my-7 space-y-3">
            {active.dimensions.map((dimension) => <div key={dimension.label} className="grid grid-cols-[minmax(5.5rem,1fr)_2fr_2rem] items-center gap-3 font-heading text-xs">
              <dt className="break-words">{dimension.label}</dt><dd aria-hidden="true" className="h-1.5 bg-track"><span className="block h-full bg-amber-text" style={{ width: `${dimension.value}%` }} /></dd><dd className="text-right">{dimension.value}</dd>
            </div>)}
          </dl>
          <Link href={`/archetypes/${active.id}`} className="inline-flex min-h-11 items-center font-heading text-sm underline underline-offset-4">{guideLabel} ↗</Link>
          <p className="mt-4 font-heading text-[11px] text-text-secondary">{sampleLabel}</p>
        </div>
      </div>
    </div>
  );
}

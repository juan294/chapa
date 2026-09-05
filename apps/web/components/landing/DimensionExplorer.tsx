"use client";

import { useEffect, useRef } from "react";

export function DimensionExplorer({ items, optionalLabel }: {
  items: { id: string; label: string; description: string; value: number }[];
  optionalLabel: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (!items.some((item) => item.id === id)) return;
      const detail = root.current?.querySelector<HTMLDetailsElement>(`[data-dimension="${id}"]`);
      if (!detail) return;
      detail.open = true;
      detail.scrollIntoView?.({ block: "center", behavior: "auto" });
    };
    window.addEventListener("chapa:landing-dimension", open);
    return () => window.removeEventListener("chapa:landing-dimension", open);
  }, [items]);
  return <div ref={root} className="border-t border-forest-line">
    {items.map((item, index) => <details key={item.id} id={`dimension-${item.id}`} data-dimension={item.id} open={index === 0} className="group border-b border-forest-line py-2">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-3 text-forest-text focus-visible:outline-forest-text!">
        <span className="font-heading text-xs text-forest-dim">{String(index + 1).padStart(2, "0")}</span>
        <span className="font-display text-3xl uppercase sm:text-4xl">{item.label}</span>
        {item.id === "craft" && <span className="font-heading text-[11px] text-forest-dim">{optionalLabel}</span>}
        <span className="ml-auto font-heading text-sm">{item.value}</span>
        <span aria-hidden="true" className="text-xl group-open:rotate-45">+</span>
      </summary>
      <p className="pb-5 pl-8 text-base leading-relaxed text-forest-dim">{item.description}</p>
    </details>)}
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

export interface OnThisPageItem {
  id: string;
  label: string;
}

/**
 * The sticky section index for long-form content routes (#1218).
 *
 * The active item carries an accent rail so a reader can tell where they are in
 * a page that runs to ten sections. It is resolved from the two things the
 * reader actually did - the URL hash they arrived on, and the link they
 * clicked - with an IntersectionObserver refining it as they scroll (#1221).
 *
 * That ordering matters. Deriving it from the observer alone left a deep link
 * marking nothing current until the observer happened to fire, and made the
 * highlight unexercisable without a live viewport: a backgrounded tab produces
 * no animation frames, so the observer delivers no entries at all.
 *
 * The list itself renders and links correctly with no JavaScript. The
 * highlight still needs hydration - the hash is read on mount - but it no
 * longer needs a scroll or a visible viewport.
 */
export function OnThisPageIndex({ items }: { items: OnThisPageItem[] }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Callers build this list inline from the dictionary, so `items` is a new
  // array on every render. Keying the effect on the array itself would
  // re-subscribe on every render, and since observing an element fires the
  // callback immediately, each subscription would set state and trigger the
  // next render: a loop that never settles and never highlights anything.
  // The ids are what the effect actually depends on.
  const observedIds = items.map((item) => item.id).join(",");

  // The hash the reader arrived on, and any later hash change. Read on mount
  // rather than during render so the server and the first client render agree.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (id && observedIds.split(",").includes(id)) setActiveId(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [observedIds]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActiveId(first.target.id);
      },
      // Bias the band towards the top of the viewport so the highlight moves
      // when a heading reaches reading position, not when it merely enters.
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const id of observedIds.split(",")) {
      const element = id ? document.getElementById(id) : null;
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [observedIds]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("content.onThisPage") as string}
      // self-start matters: as a stretched grid child the nav would be as tall
      // as the whole article, leaving sticky positioning nothing to travel in.
      className="sticky top-24 hidden self-start lg:block"
    >
      <div className="font-heading text-[10px] tracking-wider text-terminal-dim uppercase">
        {t("content.onThisPage") as string}
      </div>
      <ul className="mt-3 space-y-0.5 border-l border-stroke">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
                aria-current={isActive ? "true" : undefined}
                className={`-ml-px flex min-h-[36px] items-center border-l-2 py-1 pl-3 text-sm transition-colors ${
                  isActive
                    ? "border-amber font-medium text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

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
 * The active item carries an accent rail so a reader can tell where they are
 * in a page that runs to ten sections. Tracking is a plain IntersectionObserver
 * over the section elements: the topmost intersecting section wins, which
 * matches what a reader would call "the section I am in" better than a scroll
 * offset calculation does.
 *
 * The list renders and links correctly with no JavaScript at all; only the
 * active-item highlight depends on the observer.
 */
export function OnThisPageIndex({ items }: { items: OnThisPageItem[] }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

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
    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("content.onThisPage") as string}
      className="sticky top-24 hidden lg:block"
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

"use client";

import { useState, useEffect } from "react";

interface NavLink {
  label: string;
  href: string;
}

interface MobileNavProps {
  links: NavLink[];
}

export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-warm-stroke text-text-secondary transition-colors hover:text-text-primary hover:bg-amber/[0.06]"
        aria-label="Toggle navigation"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full border-b border-warm-stroke bg-warm-card md:hidden">
          <div className="flex flex-col px-6 py-4 gap-2">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-lg px-4 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary hover:bg-amber/[0.06]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const LANGUAGES: { code: Locale; label: string; fullName: string }[] = [
  { code: "en", label: "EN", fullName: "English" },
  { code: "es", label: "ES", fullName: "Español" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0]!;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  // Close on Escape and return focus to trigger
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
        triggerRef.current?.focus();
      }
    }
    if (isExpanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isExpanded]);

  // Auto-focus first option when dropdown opens
  useEffect(() => {
    if (isExpanded && listboxRef.current) {
      const firstOption = listboxRef.current.querySelector<HTMLElement>('[role="option"]');
      firstOption?.focus();
    }
  }, [isExpanded]);

  const handleSelect = useCallback(
    (code: Locale) => {
      setLocale(code);
      setIsExpanded(false);
    },
    [setLocale]
  );

  const handleListboxKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const listbox = listboxRef.current;
      if (!listbox) return;
      const options = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
      if (options.length === 0) return;
      const currentIndex = options.indexOf(document.activeElement as HTMLElement);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        options[currentIndex < options.length - 1 ? currentIndex + 1 : 0]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        options[currentIndex > 0 ? currentIndex - 1 : options.length - 1]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        options[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        options[options.length - 1]?.focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (currentIndex >= 0) handleSelect(LANGUAGES[currentIndex]!.code);
      }
    },
    [handleSelect]
  );

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t("aria.languageSwitcher") as string}
      className="relative"
    >
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded((v) => !v);
        }}
        aria-expanded={isExpanded}
        aria-haspopup="listbox"
        className="flex h-11 items-center gap-1.5 px-3 rounded-lg font-heading text-sm text-terminal-dim transition-colors hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/40"
      >
        <span>{current.label}</span>
        {/* Inline chevron — no icon library dependency */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-200${isExpanded ? " rotate-180" : ""}`}
        >
          <path
            d="M2 4L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        role="listbox"
        aria-label={t("aria.languageSwitcher") as string}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleListboxKeyDown}
        className={`absolute top-full right-0 mt-2 p-1.5 min-w-[8rem] rounded-lg bg-card border border-stroke shadow-card transition-all duration-200 ease-out ${
          isExpanded
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
        }`}
      >
        <div ref={listboxRef} className="flex flex-col gap-0.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={locale === lang.code}
              aria-label={lang.fullName}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(lang.code);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-md font-heading text-sm transition-colors ${
                locale === lang.code
                  ? "bg-amber/10 text-amber"
                  : "text-terminal-dim hover:text-text-primary hover:bg-stroke/30"
              }`}
            >
              {lang.label}{" "}
              <span className="text-terminal-dim/70">— {lang.fullName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

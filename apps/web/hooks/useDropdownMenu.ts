import { useState, useEffect, type RefObject } from "react";

/**
 * Shared hook for dropdown menu behavior.
 * Handles click-outside close, Escape key close, and arrow key navigation
 * for menu items with `role="menuitem"`.
 *
 * @param containerRef - Ref to the dropdown container element
 * @returns `{ isOpen, setIsOpen, activeIndex, setActiveIndex }`
 */
export function useDropdownMenu(
  containerRef: RefObject<HTMLElement | null>,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Click-outside close
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen, containerRef]);

  // Escape key close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Arrow key navigation for menu items
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    function handleMenuKeyDown(e: KeyboardEvent) {
      const items = Array.from(
        containerRef.current?.querySelectorAll('[role="menuitem"]') ?? [],
      ) as HTMLElement[];
      if (items.length === 0) return;
      const currentIndex = items.indexOf(
        document.activeElement as HTMLElement,
      );

      let nextIndex = -1;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % items.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIndex = items.length - 1;
      }
      if (nextIndex >= 0) {
        items[nextIndex]?.focus();
      }
    }
    document.addEventListener("keydown", handleMenuKeyDown);
    return () => document.removeEventListener("keydown", handleMenuKeyDown);
  }, [isOpen, containerRef]);

  return { isOpen, setIsOpen, activeIndex, setActiveIndex };
}

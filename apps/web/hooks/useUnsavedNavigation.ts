"use client";

import { useEffect } from "react";
import { APP_NAVIGATION_EVENT, navigateDocument } from "@/lib/navigation";

/**
 * Dirty editors use native navigation for app-owned exits so the browser's
 * beforeunload confirmation protects both links and keyboard commands. No
 * router/history patching: Back/Forward traversal is outside this boundary.
 */
export function useUnsavedNavigation(unsaved: boolean): void {
  useEffect(() => {
    if (!unsaved) return;

    function departingUrl(href: string): URL | null {
      const target = new URL(href, window.location.href);
      const current = new URL(window.location.href);
      return target.origin === current.origin &&
        (target.pathname !== current.pathname || target.search !== current.search)
        ? target
        : null;
    }

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey ||
          event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (!anchor || anchor.hasAttribute("download") ||
          (anchor.target && anchor.target !== "_self")) return;
      const target = departingUrl(anchor.href);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      navigateDocument(target.href);
    }

    function appNavigation(event: Event) {
      const target = departingUrl((event as CustomEvent<string>).detail);
      if (!target) return;
      event.preventDefault();
      navigateDocument(target.href);
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    window.addEventListener(APP_NAVIGATION_EVENT, appNavigation);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      window.removeEventListener(APP_NAVIGATION_EVENT, appNavigation);
    };
  }, [unsaved]);
}

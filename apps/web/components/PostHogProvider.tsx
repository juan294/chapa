"use client";

import { useEffect } from "react";
import { setPosthogInstance } from "@/lib/analytics/posthog";

function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
    if (!key || !host) return;

    let loaded = false;

    const loadPostHog = () => {
      if (loaded) return;
      loaded = true;

      import("posthog-js").then(({ default: posthog }) => {
        posthog.init(key, {
          api_host: host,
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage",
        });
        setPosthogInstance(posthog);
      });
    };

    const triggerLoad = () => {
      loadPostHog();
      window.removeEventListener("click", triggerLoad);
      window.removeEventListener("scroll", triggerLoad);
      window.removeEventListener("keydown", triggerLoad);
    };

    // Load on first user interaction
    window.addEventListener("click", triggerLoad, { once: true });
    window.addEventListener("scroll", triggerLoad, { once: true, passive: true });
    window.addEventListener("keydown", triggerLoad, { once: true });

    // Fallback: load after 5 seconds if no interaction
    const timeout = setTimeout(loadPostHog, 5000);

    return () => {
      window.removeEventListener("click", triggerLoad);
      window.removeEventListener("scroll", triggerLoad);
      window.removeEventListener("keydown", triggerLoad);
      clearTimeout(timeout);
    };
  }, []);

  return null;
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PostHogInit />
      {children}
    </>
  );
}

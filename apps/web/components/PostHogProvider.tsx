"use client";

import { useEffect } from "react";
import { setPosthogInstance } from "@/lib/analytics/posthog";

function PostHogInit() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
    if (!key || !host) return;

    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage",
      });
      setPosthogInstance(posthog);
    });
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

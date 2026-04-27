"use client";

import { ClientAnalytics } from "@/components/ClientAnalytics";
import { PostHogInit } from "@/components/PostHogProvider";

export function ClientInstrumentation() {
  return (
    <>
      <PostHogInit />
      <ClientAnalytics />
    </>
  );
}

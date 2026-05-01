"use client";

import dynamic from "next/dynamic";
import { ClientAnalytics } from "@/components/ClientAnalytics";

const PostHogInit = dynamic(
  () => import("@/components/PostHogProvider").then((m) => ({ default: m.PostHogInit })),
  { ssr: false },
);

export function ClientInstrumentation() {
  return (
    <>
      <PostHogInit />
      <ClientAnalytics />
    </>
  );
}

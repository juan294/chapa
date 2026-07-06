"use client";

import dynamic from "next/dynamic";
import { ClientAnalytics } from "@/components/ClientAnalytics";
import { ClientErrorReporter } from "@/components/ClientErrorReporter";

const PostHogInit = dynamic(
  () => import("@/components/PostHogProvider").then((m) => ({ default: m.PostHogInit })),
  { ssr: false },
);

export function ClientInstrumentation() {
  return (
    <>
      <PostHogInit />
      <ClientErrorReporter />
      <ClientAnalytics />
    </>
  );
}

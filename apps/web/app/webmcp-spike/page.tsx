import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVercelEnv } from "@/lib/env";
import { WebMcpSpikeClient } from "./WebMcpSpikeClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WebMCP Runtime Spike | Chapa",
  robots: { index: false, follow: false },
};

export default function WebMcpSpikePage() {
  if (getVercelEnv() === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-bg px-6 py-20 text-text-primary">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl font-bold">WebMCP runtime spike</h1>
        <p className="mb-8 mt-3 font-body text-text-secondary">
          This preview-only page verifies Chapa tool discovery and execution.
        </p>
        <WebMcpSpikeClient />
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

interface SpikeTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, never> };
  annotations: { readOnlyHint: true };
  execute: (
    inputs: Record<string, never>,
    context: { signal: AbortSignal },
  ) => Promise<string>;
}

interface SpikeModelContext {
  registerTool(tool: SpikeTool, options: { signal: AbortSignal }): Promise<void>;
}

type SpikeDocument = Document & { modelContext?: SpikeModelContext };

export function WebMcpSpikeClient() {
  const [status, setStatus] = useState("Checking WebMCP support");

  useEffect(() => {
    if (!("modelContext" in document)) {
      queueMicrotask(() => setStatus("WebMCP is not available in this browser"));
      return;
    }
    const modelContext = (document as SpikeDocument).modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      queueMicrotask(() => setStatus("WebMCP is not available in this browser"));
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        await modelContext.registerTool(
          {
            name: "chapa_hello",
            description: "Returns a greeting from Chapa.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true },
            execute: async () => "Hello from Chapa Creator Studio",
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setStatus("WebMCP tool registered");
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("WebMCP registration failed");
        }
      }
    })();

    return () => controller.abort();
  }, []);

  return (
    <section className="rounded-lg border border-border bg-surface p-6 font-heading">
      <p className="text-sm text-text-secondary">Runtime status</p>
      <p className="mt-2 text-lg text-amber" role="status">
        {status}
      </p>
      <p className="mt-4 text-sm text-text-secondary">
        Expected tool: <code>chapa_hello</code>
      </p>
    </section>
  );
}

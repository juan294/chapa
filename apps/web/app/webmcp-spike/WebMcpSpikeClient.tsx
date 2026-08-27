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
  getTools?(): Promise<Array<{ name: string }>>;
  executeTool?(
    tool: { name: string },
    inputs: Record<string, never> | string,
  ): Promise<string | null>;
}

type SpikeDocument = Document & { modelContext?: SpikeModelContext };
const HELLO_TOOL_NAME = "chapa_hello";

export function WebMcpSpikeClient() {
  const [status, setStatus] = useState("Checking WebMCP support");
  const [registered, setRegistered] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);
  const [executionRunning, setExecutionRunning] = useState(false);

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
            name: HELLO_TOOL_NAME,
            description: "Returns a greeting from Chapa.",
            inputSchema: { type: "object", properties: {} },
            annotations: { readOnlyHint: true },
            execute: async () => "Hello from Chapa Creator Studio",
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setStatus("WebMCP tool registered");
          setRegistered(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("WebMCP registration failed");
        }
      }
    })();

    return () => controller.abort();
  }, []);

  async function runDiscoveryTest() {
    if (executionRunning) {
      return;
    }
    const modelContext = (document as SpikeDocument).modelContext;
    if (
      typeof modelContext?.getTools !== "function" ||
      typeof modelContext.executeTool !== "function"
    ) {
      setExecutionResult("WebMCP testing interface is not available");
      return;
    }

    setExecutionRunning(true);
    try {
      const tools = await modelContext.getTools();
      const hello = tools.find((tool) => tool.name === HELLO_TOOL_NAME);
      if (!hello) {
        setExecutionResult(`${HELLO_TOOL_NAME} was not discovered`);
        return;
      }
      let result: string | null;
      try {
        result = await modelContext.executeTool(hello, {});
      } catch {
        result = await modelContext.executeTool(hello, "{}");
      }
      setExecutionResult(result ?? `${HELLO_TOOL_NAME} returned no result`);
    } catch {
      setExecutionResult("WebMCP discovery or execution failed");
    } finally {
      setExecutionRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-6 font-heading">
      <p className="text-sm text-text-secondary">Runtime status</p>
      <p className="mt-2 text-lg text-amber" role="status">
        {status}
      </p>
      <p className="mt-4 text-sm text-text-secondary">
        Expected tool: <code>{HELLO_TOOL_NAME}</code>
      </p>
      {registered ? (
        <button
          className="mt-4 rounded border border-amber px-3 py-2 text-sm text-amber"
          disabled={executionRunning}
          onClick={() => void runDiscoveryTest()}
          type="button"
        >
          Run discovery and execution
        </button>
      ) : null}
      {executionResult ? (
        <output aria-live="polite" className="mt-4 block text-sm text-text-primary">
          {executionResult}
        </output>
      ) : null}
    </section>
  );
}

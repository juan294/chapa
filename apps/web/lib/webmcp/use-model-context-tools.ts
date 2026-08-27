"use client";

import { useEffect } from "react";
import { messageFromReason } from "@/lib/analytics/error-message";
import { trackEvent } from "@/lib/analytics/posthog";

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface WebMcpExecutionContext {
  signal: AbortSignal;
}

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute(
    inputs: Record<string, unknown>,
    context: WebMcpExecutionContext,
  ): string | Promise<string>;
}

function captureToolEvent(event: string, properties: Record<string, unknown>): void {
  try {
    trackEvent(event, properties);
  } catch {
    // Instrumentation must never change tool behavior.
  }
}

function instrumentTool(tool: WebMcpTool): WebMcpTool {
  return {
    ...tool,
    async execute(inputs, context) {
      captureToolEvent("webmcp_tool_called", { tool: tool.name });
      try {
        return await tool.execute(inputs, context);
      } catch (error) {
        captureToolEvent("client_error", {
          source: "webmcp_tool_execute",
          tool: tool.name,
          message: messageFromReason(error).slice(0, 500),
        });
        throw error;
      }
    },
  };
}

function warnRegistrationFailure(toolName: string, error: unknown): void {
  console.warn(`[webmcp] failed to register tool ${toolName}`, error);
}

export function useModelContextTools(tools: WebMcpTool[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || !("modelContext" in document)) {
      return;
    }

    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      return;
    }

    const controller = new AbortController();
    for (const tool of tools) {
      try {
        void Promise.resolve(
          modelContext.registerTool(instrumentTool(tool), {
            signal: controller.signal,
          }),
        ).catch((error: unknown) => {
          if (!controller.signal.aborted) {
            warnRegistrationFailure(tool.name, error);
          }
        });
      } catch (error) {
        warnRegistrationFailure(tool.name, error);
      }
    }

    return () => controller.abort();
  }, [tools, enabled]);
}

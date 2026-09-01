"use client";

import { useEffect, useRef } from "react";
import { messageFromReason } from "@/lib/analytics/error-message";
import { trackEvent } from "@/lib/analytics/posthog";
import { WEBMCP_INVALID_INPUT_PREFIX } from "./errors";
import type { WebMcpTool } from "./shared-tools";

export {
  invalidInput,
  WEBMCP_INVALID_INPUT_PREFIX,
} from "./errors";
export type {
  WebMcpTool,
} from "./shared-tools";

function captureToolEvent(event: string, properties: Record<string, unknown>): void {
  try {
    trackEvent(event, properties);
  } catch {
    // Instrumentation must never change tool behavior.
  }
}

function instrumentTool(
  tool: WebMcpTool,
  resolveCurrentTool: () => WebMcpTool,
): WebMcpTool {
  return {
    ...tool,
    async execute(
      inputs,
      context = { signal: new AbortController().signal },
    ) {
      const start = performance.now();
      try {
        const result = await resolveCurrentTool().execute(inputs, context);
        captureToolEvent("webmcp_tool_called", {
          tool: tool.name,
          outcome: result.startsWith(WEBMCP_INVALID_INPUT_PREFIX)
            ? "invalid_input"
            : "ok",
          durationMs: Math.round(performance.now() - start),
        });
        return result;
      } catch (error) {
        captureToolEvent("webmcp_tool_called", {
          tool: tool.name,
          outcome: "error",
          durationMs: Math.round(performance.now() - start),
        });
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
  const currentToolsRef = useRef(new Map<string, WebMcpTool>());
  const catalogSignature = JSON.stringify(
    tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    })),
  );

  useEffect(() => {
    currentToolsRef.current = new Map(tools.map((tool) => [tool.name, tool]));
  }, [tools]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || !("modelContext" in document)) {
      return;
    }

    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      return;
    }

    const controller = new AbortController();
    for (const tool of currentToolsRef.current.values()) {
      try {
        void Promise.resolve(
          modelContext.registerTool(instrumentTool(
            tool,
            () => currentToolsRef.current.get(tool.name) ?? tool,
          ), {
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
  }, [catalogSignature, enabled]);
}

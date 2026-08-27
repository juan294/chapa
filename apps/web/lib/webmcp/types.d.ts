export {};

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: import("./use-model-context-tools").WebMcpTool,
        options: { signal: AbortSignal },
      ): Promise<void>;
    };
  }
}

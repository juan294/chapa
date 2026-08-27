// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics/posthog";
import {
  useModelContextTools,
  type WebMcpTool,
} from "./use-model-context-tools";

vi.mock("@/lib/analytics/posthog", () => ({
  trackEvent: vi.fn(),
}));

interface RegisterToolCall {
  tool: WebMcpTool;
  options: { signal: AbortSignal };
}

function makeTool(name = "test_tool"): WebMcpTool {
  return {
    name,
    title: "Test tool",
    description: "Exercises the WebMCP registration hook.",
    inputSchema: {
      type: "object",
      properties: { value: { type: "string" } },
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: false,
    },
    execute: vi.fn().mockResolvedValue("ok"),
  };
}

function installModelContext(registerTool: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: { registerTool },
  });
}

function readRegisterCall(registerTool: ReturnType<typeof vi.fn>, index = 0): RegisterToolCall {
  const [tool, options] = registerTool.mock.calls[index] as [
    WebMcpTool,
    { signal: AbortSignal },
  ];
  return { tool, options };
}

describe("useModelContextTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(document, "modelContext");
    vi.restoreAllMocks();
  });

  it("registers instrumented tools when enabled and WebMCP is present", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const execute = vi.fn().mockResolvedValue("tool result");
    const tool = { ...makeTool("hello_tool"), execute };

    renderHook(() => useModelContextTools([tool], true));

    expect(registerTool).toHaveBeenCalledOnce();
    const registered = readRegisterCall(registerTool);
    expect(registered.tool).toMatchObject({
      name: "hello_tool",
      title: "Test tool",
      description: "Exercises the WebMCP registration hook.",
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
    });

    const inputs = { value: "hello" };
    const executionController = new AbortController();
    await expect(
      registered.tool.execute(inputs, { signal: executionController.signal }),
    ).resolves.toBe("tool result");
    expect(execute).toHaveBeenCalledWith(inputs, {
      signal: executionController.signal,
    });
    expect(trackEvent).toHaveBeenCalledWith("webmcp_tool_called", {
      tool: "hello_tool",
    });
  });

  it("does not register tools when disabled", () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);

    renderHook(() => useModelContextTools([makeTool()], false));

    expect(registerTool).not.toHaveBeenCalled();
  });

  it("does not register tools when WebMCP is absent", () => {
    renderHook(() => useModelContextTools([makeTool()], true));

    expect("modelContext" in document).toBe(false);
  });

  it("does not register tools when modelContext is malformed", () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {},
    });

    expect(() => renderHook(() => useModelContextTools([makeTool()], true))).not.toThrow();
  });

  it("aborts registered tools on unmount", () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);

    const { unmount } = renderHook(() => useModelContextTools([makeTool()], true));
    const registered = readRegisterCall(registerTool);
    expect(registered.options.signal.aborted).toBe(false);

    unmount();

    expect(registered.options.signal.aborted).toBe(true);
  });

  it("keeps registrations stable when only execute implementations change", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const firstExecute = vi.fn().mockResolvedValue("first");
    const secondExecute = vi.fn().mockResolvedValue("second");
    const firstTools = [{ ...makeTool(), execute: firstExecute }];
    const secondTools = [{ ...makeTool(), execute: secondExecute }];

    const { rerender } = renderHook(
      ({ tools }) => useModelContextTools(tools, true),
      { initialProps: { tools: firstTools } },
    );
    const registration = readRegisterCall(registerTool);

    rerender({ tools: secondTools });

    expect(registration.options.signal.aborted).toBe(false);
    expect(registerTool).toHaveBeenCalledOnce();
    await expect(
      registration.tool.execute({}, { signal: new AbortController().signal }),
    ).resolves.toBe("second");
    expect(firstExecute).not.toHaveBeenCalled();
    expect(secondExecute).toHaveBeenCalledOnce();
  });

  it("aborts and re-registers when the tool catalog changes", () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const firstTools = [makeTool("first_tool")];
    const secondTools = [makeTool("second_tool")];

    const { rerender } = renderHook(
      ({ tools }) => useModelContextTools(tools, true),
      { initialProps: { tools: firstTools } },
    );
    const firstRegistration = readRegisterCall(registerTool);

    rerender({ tools: secondTools });

    expect(firstRegistration.options.signal.aborted).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(2);
    const secondRegistration = readRegisterCall(registerTool, 1);
    expect(secondRegistration.tool.name).toBe("second_tool");
    expect(secondRegistration.options.signal.aborted).toBe(false);
  });

  it("contains an asynchronously rejected registration", async () => {
    const registrationError = new Error("duplicate tool name");
    const registerTool = vi.fn().mockRejectedValue(registrationError);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installModelContext(registerTool);

    expect(() => renderHook(() => useModelContextTools([makeTool()], true))).not.toThrow();

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[webmcp] failed to register tool test_tool",
        registrationError,
      );
    });
  });

  it("contains a synchronous registration failure", () => {
    const registrationError = new Error("registration unavailable");
    const registerTool = vi.fn(() => {
      throw registrationError;
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    installModelContext(registerTool);

    expect(() => renderHook(() => useModelContextTools([makeTool()], true))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      "[webmcp] failed to register tool test_tool",
      registrationError,
    );
  });

  it("does not warn when cleanup aborts a pending registration", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registerTool = vi.fn(
      (_tool: WebMcpTool, options: { signal: AbortSignal }) =>
        new Promise<void>((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("Registration aborted", "AbortError"));
          });
        }),
    );
    installModelContext(registerTool);

    const { unmount } = renderHook(() =>
      useModelContextTools([makeTool()], true),
    );
    unmount();
    await Promise.resolve();

    expect(warn).not.toHaveBeenCalled();
  });

  it("captures execution errors and preserves rejection semantics", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const executionError = new Error("tool failed");
    const tool = makeTool("failing_tool");
    tool.execute = vi.fn().mockRejectedValue(executionError);
    renderHook(() => useModelContextTools([tool], true));
    const registered = readRegisterCall(registerTool);

    await expect(
      registered.tool.execute({}, { signal: new AbortController().signal }),
    ).rejects.toBe(executionError);
    expect(trackEvent).toHaveBeenNthCalledWith(1, "webmcp_tool_called", {
      tool: "failing_tool",
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, "client_error", {
      source: "webmcp_tool_execute",
      tool: "failing_tool",
      message: "tool failed",
    });
  });

  it("preserves an undefined rejection while capturing a safe message", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const tool = makeTool("undefined_rejection_tool");
    tool.execute = vi.fn().mockRejectedValue(undefined);
    renderHook(() => useModelContextTools([tool], true));
    const registered = readRegisterCall(registerTool);

    await expect(
      registered.tool.execute({}, { signal: new AbortController().signal }),
    ).rejects.toBeUndefined();
    expect(trackEvent).toHaveBeenNthCalledWith(2, "client_error", {
      source: "webmcp_tool_execute",
      tool: "undefined_rejection_tool",
      message: "undefined",
    });
  });

  it("preserves a hostile rejection while capturing a fallback message", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    installModelContext(registerTool);
    const rejection = {
      toJSON() {
        throw new Error("cannot serialize");
      },
      [Symbol.toPrimitive]() {
        throw new Error("cannot coerce");
      },
    };
    const tool = makeTool("hostile_rejection_tool");
    tool.execute = vi.fn().mockRejectedValue(rejection);
    renderHook(() => useModelContextTools([tool], true));
    const registered = readRegisterCall(registerTool);

    await expect(
      registered.tool.execute({}, { signal: new AbortController().signal }),
    ).rejects.toBe(rejection);
    expect(trackEvent).toHaveBeenNthCalledWith(2, "client_error", {
      source: "webmcp_tool_execute",
      tool: "hostile_rejection_tool",
      message: "Unknown error",
    });
  });
});

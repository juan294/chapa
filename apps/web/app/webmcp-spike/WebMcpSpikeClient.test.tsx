// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebMcpSpikeClient } from "./WebMcpSpikeClient";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document, "modelContext");
});

describe("WebMcpSpikeClient", () => {
  it("registers the hello tool and aborts it on unmount", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });

    const { unmount } = render(<WebMcpSpikeClient />);

    await waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [tool, options] = registerTool.mock.calls[0]!;
    expect(tool).toMatchObject({
      name: "chapa_hello",
      description: "Returns a greeting from Chapa.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
    });
    await expect(tool.execute({}, { signal: new AbortController().signal })).resolves.toBe(
      "Hello from Chapa Creator Studio",
    );
    expect(options.signal.aborted).toBe(false);
    expect(await screen.findByText("WebMCP tool registered")).toBeTruthy();

    unmount();
    expect(options.signal.aborted).toBe(true);
  });

  it("degrades gracefully when WebMCP is unavailable", async () => {
    render(<WebMcpSpikeClient />);

    expect(await screen.findByText("WebMCP is not available in this browser")).toBeTruthy();
  });

  it("degrades gracefully when modelContext is malformed", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: undefined,
    });

    render(<WebMcpSpikeClient />);

    expect(await screen.findByText("WebMCP is not available in this browser")).toBeTruthy();
  });

  it("reports registration failures without breaking the page", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: vi.fn().mockRejectedValue(new Error("registration failed")) },
    });

    render(<WebMcpSpikeClient />);

    expect(await screen.findByText("WebMCP registration failed")).toBeTruthy();
  });

  it("reports synchronous registration failures without breaking the page", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn(() => {
          throw new Error("registration failed");
        }),
      },
    });

    render(<WebMcpSpikeClient />);

    expect(await screen.findByText("WebMCP registration failed")).toBeTruthy();
  });

  it("ignores a stale registration result after effect cleanup", async () => {
    let resolveFirst!: () => void;
    const firstRegistration = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const registerTool = vi
      .fn()
      .mockReturnValueOnce(firstRegistration)
      .mockRejectedValueOnce(new Error("current registration failed"));
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });

    render(
      <StrictMode>
        <WebMcpSpikeClient />
      </StrictMode>,
    );
    expect(await screen.findByText("WebMCP registration failed")).toBeTruthy();

    resolveFirst();
    await firstRegistration;

    expect(screen.getByText("WebMCP registration failed")).toBeTruthy();
  });

  it("discovers and executes the hello tool through Chrome's testing interface", async () => {
    const helloTool = { name: "chapa_hello" };
    const executeTool = vi.fn().mockResolvedValue("Hello from Chapa Creator Studio");
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn().mockResolvedValue(undefined),
        getTools: vi.fn().mockResolvedValue([helloTool]),
        executeTool,
      },
    });
    render(<WebMcpSpikeClient />);
    await screen.findByText("WebMCP tool registered");

    fireEvent.click(screen.getByRole("button", { name: "Run discovery and execution" }));

    expect(await screen.findByText("Hello from Chapa Creator Studio")).toBeTruthy();
    expect(executeTool).toHaveBeenCalledWith(helloTool, {});
  });

  it("falls back to Chrome's JSON-string testing input when object input is rejected", async () => {
    const helloTool = { name: "chapa_hello" };
    const executeTool = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("expected JSON string"))
      .mockResolvedValueOnce("Hello from Chapa Creator Studio");
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn().mockResolvedValue(undefined),
        getTools: vi.fn().mockResolvedValue([helloTool]),
        executeTool,
      },
    });
    render(<WebMcpSpikeClient />);
    await screen.findByText("WebMCP tool registered");

    fireEvent.click(screen.getByRole("button", { name: "Run discovery and execution" }));

    expect(await screen.findByText("Hello from Chapa Creator Studio")).toBeTruthy();
    expect(executeTool.mock.calls).toEqual([
      [helloTool, {}],
      [helloTool, "{}"],
    ]);
  });

  it("reports when Chrome's testing interface is unavailable", async () => {
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool: vi.fn().mockResolvedValue(undefined) },
    });
    render(<WebMcpSpikeClient />);
    await screen.findByText("WebMCP tool registered");

    fireEvent.click(screen.getByRole("button", { name: "Run discovery and execution" }));

    expect(await screen.findByText("WebMCP testing interface is not available")).toBeTruthy();
  });

  it("prevents concurrent discovery and execution runs", async () => {
    let resolveTools!: (tools: Array<{ name: string }>) => void;
    const getTools = vi.fn().mockReturnValue(
      new Promise<Array<{ name: string }>>((resolve) => {
        resolveTools = resolve;
      }),
    );
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: vi.fn().mockResolvedValue(undefined),
        getTools,
        executeTool: vi.fn().mockResolvedValue("Hello from Chapa Creator Studio"),
      },
    });
    render(<WebMcpSpikeClient />);
    await screen.findByText("WebMCP tool registered");
    const button = screen.getByRole("button", { name: "Run discovery and execution" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(getTools).toHaveBeenCalledOnce();
    resolveTools([{ name: "chapa_hello" }]);
    expect(await screen.findByText("Hello from Chapa Creator Studio")).toBeTruthy();
  });
});

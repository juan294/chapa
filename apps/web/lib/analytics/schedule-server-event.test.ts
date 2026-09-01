import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  captureServerEvent: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./server-errors", () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

import {
  scheduleAgentSurfaceFetch,
  scheduleServerEvent,
} from "./schedule-server-event";

describe("request-lifetime server event scheduling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defers event delivery through Next after()", async () => {
    scheduleServerEvent("mcp_tool_called", { tool: "find_profile" });

    expect(mocks.captureServerEvent).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledOnce();

    const callback = mocks.after.mock.calls[0]?.[0] as (() => Promise<void>);
    await callback();
    expect(mocks.captureServerEvent).toHaveBeenCalledWith("mcp_tool_called", {
      tool: "find_profile",
    });
  });

  it("classifies an agent surface without retaining the raw user agent", async () => {
    const request = new Request("https://chapa.test/llms.txt", {
      headers: { "user-agent": "GPTBot/1.2 secret-fragment" },
    });

    scheduleAgentSurfaceFetch(request, "llms.txt");
    const callback = mocks.after.mock.calls[0]?.[0] as (() => Promise<void>);
    await callback();

    expect(mocks.captureServerEvent).toHaveBeenCalledWith(
      "agent_surface_fetch",
      { surface: "llms.txt", agentClass: "openai" },
    );
    expect(mocks.captureServerEvent.mock.calls[0]?.[1]).not.toHaveProperty("ua");
  });

  it("does not schedule normal browser traffic", () => {
    scheduleAgentSurfaceFetch(
      new Request("https://chapa.test/llms.txt", {
        headers: { "user-agent": "Mozilla/5.0 Chrome/128.0.0.0" },
      }),
      "llms.txt",
    );

    expect(mocks.after).not.toHaveBeenCalled();
  });
});

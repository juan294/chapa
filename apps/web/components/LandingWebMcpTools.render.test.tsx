// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import {
  invalidInput,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";
import { LandingWebMcpTools } from "./LandingWebMcpTools";

const mocks = vi.hoisted(() => ({
  useModelContextTools: vi.fn(),
  useClientFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/webmcp/use-model-context-tools", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/webmcp/use-model-context-tools")
  >();
  return {
    ...actual,
    useModelContextTools: (...args: unknown[]) =>
      mocks.useModelContextTools(...args),
  };
});

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => mocks.useClientFeatureFlags(),
}));

function renderHost() {
  const { container } = render(<LandingWebMcpTools />);
  const [tools, enabled] = mocks.useModelContextTools.mock.calls.at(-1) as [
    WebMcpTool[],
    boolean,
  ];
  return {
    container,
    tools,
    enabled,
    getTool(name: string) {
      const tool = tools.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing tool ${name}`);
      return tool;
    },
  };
}

async function execute(
  tool: WebMcpTool,
  inputs: Record<string, unknown> = {},
): Promise<string> {
  return tool.execute(inputs, { signal: new AbortController().signal });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useClientFeatureFlags.mockReturnValue({ webmcpEnabled: true });
});

afterEach(cleanup);

describe("LandingWebMcpTools", () => {
  it("registers exactly two read-only tools behind the WebMCP flag", () => {
    const { container, tools, enabled } = renderHost();

    expect(container.childNodes).toHaveLength(0);
    expect(enabled).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual([
      "get_site_capabilities",
      "find_profile",
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(
      true,
    );
  });

  it("registers no tools when the WebMCP flag is disabled", () => {
    mocks.useClientFeatureFlags.mockReturnValue({ webmcpEnabled: false });

    const { tools, enabled } = renderHost();

    expect(tools).toEqual([]);
    expect(enabled).toBe(false);
  });

  it("describes the site tool map, entry points, and human boundaries", async () => {
    const { getTool } = renderHost();
    const tool = getTool("get_site_capabilities");
    const result = JSON.parse(await execute(tool));

    expect(tool.annotations).toEqual({ readOnlyHint: true });
    expect(result.toolMap).toEqual(SITE_TOOL_MAP);
    expect(result.entryPoints).toEqual({
      demoStudio: "https://chapa.thecreativetoken.com/studio?demo=1",
      profile: "https://chapa.thecreativetoken.com/u/<handle>",
      scoringMethodology: "https://chapa.thecreativetoken.com/about/scoring",
      llmsTxt: "https://chapa.thecreativetoken.com/llms.txt",
    });
    expect(result.boundaries).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/login.*human/i),
        expect.stringMatching(/save.*human/i),
      ]),
    );
  });

  it("returns the shared invalid-input response for an invalid handle", async () => {
    const { getTool } = renderHost();

    await expect(
      execute(getTool("find_profile"), { handle: "bad/handle" }),
    ).resolves.toBe(
      invalidInput("find_profile", "handle must be a public GitHub handle"),
    );
  });

  it("returns canonical profile URLs and navigation notes for a valid handle", async () => {
    const { getTool } = renderHost();
    const result = JSON.parse(
      await execute(getTool("find_profile"), { handle: " developer " }),
    );

    expect(result).toMatchObject({
      handle: "developer",
      sharePageUrl: "https://chapa.thecreativetoken.com/u/developer",
      badgeSvgUrl:
        "https://chapa.thecreativetoken.com/u/developer/badge.svg",
    });
    expect(result.notes.join(" ")).toMatch(/generated on first visit/i);
    expect(result.notes.join(" ")).toMatch(/share page registers six more tools/i);
  });
});

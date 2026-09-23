// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebMcpTool } from "@/lib/webmcp/use-model-context-tools";
import { VerifyPageWebMcpTools } from "./VerifyPageWebMcpTools";

const mocks = vi.hoisted(() => ({
  webmcpEnabled: true,
  useModelContextTools: vi.fn(),
}));

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => ({ webmcpEnabled: mocks.webmcpEnabled }),
}));

vi.mock("@/lib/webmcp/use-model-context-tools", () => ({
  useModelContextTools: mocks.useModelContextTools,
}));

const hash = "a1b2c3d4e5f6a7b8";

function registeredTools(): WebMcpTool[] {
  const call = mocks.useModelContextTools.mock.calls.at(-1);
  if (!call) throw new Error("WebMCP tools were not registered");
  return call[0] as WebMcpTool[];
}

async function execute(tool: WebMcpTool): Promise<string> {
  return tool.execute({}, { signal: new AbortController().signal });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.webmcpEnabled = true;
});

describe("VerifyPageWebMcpTools", () => {
  it("registers two read-only tools behind the client WebMCP flag", () => {
    const { container } = render(
      <VerifyPageWebMcpTools hash={hash} isV7={false} />,
    );

    expect(container.childNodes).toHaveLength(0);
    expect(mocks.useModelContextTools).toHaveBeenCalledOnce();
    expect(mocks.useModelContextTools).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    expect(
      registeredTools().map(({ name, inputSchema, annotations }) => ({
        name,
        inputSchema,
        annotations,
      })),
    ).toEqual([
      {
        name: "get_verification_record",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
      },
      {
        name: "explain_verification",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
      },
    ]);
  });

  it("passes the disabled flag through to registration", () => {
    mocks.webmcpEnabled = false;

    render(<VerifyPageWebMcpTools hash={hash} isV7={false} />);

    expect(mocks.useModelContextTools).toHaveBeenCalledWith(
      [],
      false,
    );
  });

  it("fetches the live verification result for a retired legacy hash, including the 410", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "retired_v6_code", message: "retired" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VerifyPageWebMcpTools hash={hash} isV7={false} />);

    const tool = registeredTools().find(
      (candidate) => candidate.name === "get_verification_record",
    );
    if (!tool) throw new Error("Missing get_verification_record tool");

    expect(JSON.parse(await execute(tool))).toEqual({
      status: "retired_v6_code",
      message: "retired",
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/verify/${hash}`, expect.objectContaining({ cache: "no-store" }));
  });

  it("reports an unavailable result on a network failure without claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<VerifyPageWebMcpTools hash={hash} isV7={false} />);

    const tool = registeredTools().find(
      (candidate) => candidate.name === "get_verification_record",
    );
    if (!tool) throw new Error("Missing get_verification_record tool");

    expect(JSON.parse(await execute(tool))).toEqual({
      error: "Verification could not be checked. Retry later; no cached receipt is returned.",
    });
  });

  it("explains HMAC-SHA256 guarantees and explicit limits for a retired legacy hash", async () => {
    render(<VerifyPageWebMcpTools hash={hash} isV7={false} />);

    const tool = registeredTools().find(
      (candidate) => candidate.name === "explain_verification",
    );
    if (!tool) throw new Error("Missing explain_verification tool");

    const explanation = JSON.parse(await execute(tool)) as {
      algorithm: string;
      howItWorks: string;
      codeFormat: string;
      proves: string[];
      doesNotProve: string[];
    };

    expect(explanation.algorithm).toBe("HMAC-SHA256");
    expect(explanation.codeFormat).toBe(
      "Legacy 16-character verification code; lookup does not replay the complete signed payload.",
    );
    expect(explanation.howItWorks).toContain("secret key");
    expect(explanation.proves.join(" ")).toMatch(/Chapa|changing|different/i);
    expect(explanation.doesNotProve.join(" ")).toMatch(
      /does not recompute.*SVG/i,
    );
    expect(explanation.doesNotProve.join(" ")).toMatch(
      /does not expose every signed/i,
    );
    expect(explanation.doesNotProve.join(" ")).toMatch(/platform data/i);
    expect(explanation.doesNotProve.join(" ")).toMatch(/prevent.*edit/i);
    expect(explanation.doesNotProve.join(" ")).toMatch(/permanent|expire/i);
  });

  it.each([
    [8, "a1b2c3d4", "Legacy 8-character verification code; lookup does not replay the complete signed payload."],
    [
      16,
      "a1b2c3d4e5f6a7b8",
      "Legacy 16-character verification code; lookup does not replay the complete signed payload.",
    ],
    [
      32,
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      "Legacy 32-character verification code; lookup does not replay the complete signed payload.",
    ],
  ])("describes the supported %i-character format", async (_length, code, format) => {
    render(<VerifyPageWebMcpTools hash={code} isV7={false} />);
    const tool = registeredTools().find(
      (candidate) => candidate.name === "explain_verification",
    );
    if (!tool) throw new Error("Missing explain_verification tool");

    expect(JSON.parse(await execute(tool))).toMatchObject({
      codeFormat: format,
    });
  });

  it("rechecks current v7 authorization when an agent requests the displayed record", async () => {
    const token = `v7.11111111-1111-4111-8111-111111111111.${"a".repeat(64)}`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: "v7", status: "revoked", signatureAuthenticated: false }), { status: 410, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VerifyPageWebMcpTools hash={token} isV7={true} />);
    const tools = registeredTools();
    const get = tools.find(tool => tool.name === "get_verification_record")!;
    expect(JSON.parse(await execute(get))).toMatchObject({ version: "v7", status: "revoked", signatureAuthenticated: false });
    expect(fetchMock).toHaveBeenCalledWith(`/api/verify/${token}`, expect.objectContaining({ cache: "no-store" }));
    const explain = tools.find(tool => tool.name === "explain_verification")!;
    const result = JSON.parse(await execute(explain));
    expect(result.howItWorks).toContain("complete canonical receipt");
    expect(result.doesNotProve.join(" ")).toMatch(/SVG/);
  });
});

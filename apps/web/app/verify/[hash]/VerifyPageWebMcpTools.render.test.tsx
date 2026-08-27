// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationRecord } from "@/lib/verification/types";
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
const record: VerificationRecord = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 72,
  confidence: 85,
  tier: "Gold",
  archetype: "Builder",
  dimensions: {
    delivery: 80,
    quality: 70,
    consistency: 65,
    breadth: 55,
  },
  commitsTotal: 420,
  prsMergedCount: 38,
  reviewsSubmittedCount: 15,
  generatedAt: "2026-03-22",
  profileType: "verified",
};

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
  mocks.webmcpEnabled = true;
});

describe("VerifyPageWebMcpTools", () => {
  it("registers two read-only tools behind the client WebMCP flag", () => {
    const { container } = render(
      <VerifyPageWebMcpTools hash={hash} record={record} />,
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
        annotations: { readOnlyHint: true },
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

    render(<VerifyPageWebMcpTools hash={hash} record={record} />);

    expect(mocks.useModelContextTools).toHaveBeenCalledWith(
      [],
      false,
    );
  });

  it("serializes the on-page hash and verification record", async () => {
    render(<VerifyPageWebMcpTools hash={hash} record={record} />);

    const tool = registeredTools().find(
      (candidate) => candidate.name === "get_verification_record",
    );
    if (!tool) throw new Error("Missing get_verification_record tool");

    expect(JSON.parse(await execute(tool))).toEqual({ hash, record });
  });

  it("explains HMAC-SHA256 guarantees and explicit limits", async () => {
    render(<VerifyPageWebMcpTools hash={hash} record={record} />);

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
      "Verified legacy 16-character verification code.",
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
    [8, "a1b2c3d4", "Verified legacy 8-character verification code."],
    [
      16,
      "a1b2c3d4e5f6a7b8",
      "Verified legacy 16-character verification code.",
    ],
    [
      32,
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      "Current 32-character verification code.",
    ],
  ])("describes the supported %i-character format", async (_length, code, format) => {
    render(<VerifyPageWebMcpTools hash={code} record={record} />);
    const tool = registeredTools().find(
      (candidate) => candidate.name === "explain_verification",
    );
    if (!tool) throw new Error("Missing explain_verification tool");

    expect(JSON.parse(await execute(tool))).toMatchObject({
      codeFormat: format,
    });
  });
});

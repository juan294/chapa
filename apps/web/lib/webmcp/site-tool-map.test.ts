import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_TOOL_MAP } from "./site-tool-map";

const EXPECTED_SITE_TOOL_MAP = [
  {
    route: "/",
    goal: "Discover Chapa and route to the right page",
    tools: ["get_site_capabilities", "find_profile"],
  },
  {
    route: "/studio (and /studio?demo=1)",
    goal: "Co-design the badge; agent proposes, human confirms saves",
    tools: [
      "list_style_options",
      "apply_badge_style",
      "apply_preset",
      "preview_badge",
      "reset_badge_config",
      "save_badge_config",
      "simulate_score",
      "suggest_improvements",
      "explain_dimension",
    ],
  },
  {
    route: "/u/:handle",
    goal: "Read, compare, verify, and embed a public credential",
    tools: [
      "get_impact_profile",
      "get_impact_history",
      "verify_badge",
      "explain_dimension",
      "compare_profiles",
      "get_embed_snippet",
    ],
  },
  {
    route: "/verify/:hash",
    goal: "Confirm what a verification code proves and does not prove",
    tools: ["get_verification_record", "explain_verification"],
  },
] as const;

function sourceFactoryToolName(
  relativePath: string,
  factoryName: string,
): string {
  const source = readFileSync(resolve(__dirname, relativePath), "utf8");
  const factoryStart = source.indexOf(`export function ${factoryName}`);
  if (factoryStart === -1) {
    throw new Error(`Missing tool factory ${factoryName} in ${relativePath}`);
  }
  const nextExport = source.indexOf("\nexport ", factoryStart + 1);
  const factorySource = source.slice(
    factoryStart,
    nextExport === -1 ? undefined : nextExport,
  );
  const literalName = factorySource.match(/\bname:\s*"([^"]+)"/);
  if (!literalName?.[1]) {
    throw new Error(`Missing tool name in factory ${factoryName}`);
  }
  return literalName[1];
}

const SHARED_TOOL_FACTORIES = new Map([
  [
    "createExplainDimensionTool",
    sourceFactoryToolName("./shared-tools.ts", "createExplainDimensionTool"),
  ],
]);

function sourceCatalog(relativePath: string): string[] {
  const source = readFileSync(resolve(__dirname, relativePath), "utf8");
  return source.split("\n").flatMap((line) => {
    const literalName = line.match(/\bname:\s*"([^"]+)"/);
    if (literalName?.[1]) return [literalName[1]];
    for (const [factoryName, toolName] of SHARED_TOOL_FACTORIES) {
      if (line.includes(`${factoryName}({`)) return [toolName];
    }
    return [];
  });
}

describe("SITE_TOOL_MAP", () => {
  it("lists the exact four route groups and shipped tool names", () => {
    expect(SITE_TOOL_MAP).toEqual(EXPECTED_SITE_TOOL_MAP);
  });

  it.each([
    [0, "../../components/LandingWebMcpTools.tsx"],
    [1, "../../app/studio/useStudioWebMcpTools.ts"],
    [2, "../../app/u/[handle]/SharePageWebMcpTools.tsx"],
    [3, "../../app/verify/[hash]/VerifyPageWebMcpTools.tsx"],
  ] as const)("keeps route group %i aligned with its source catalog", (index, source) => {
    expect(SITE_TOOL_MAP[index].tools).toEqual(sourceCatalog(source));
  });
});

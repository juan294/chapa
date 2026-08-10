import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern = /^[0-9a-f]{40}$/i;

export type VersionResponse = {
  commitSha: string | null;
  environment: string | null;
};

export function parseVersionResponse(raw: string): VersionResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("version response is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("version response must be an object");
  }
  const value = parsed as Record<string, unknown>;
  if (
    value.commitSha !== null &&
    (typeof value.commitSha !== "string" || !shaPattern.test(value.commitSha))
  ) {
    throw new Error("version response has an invalid commitSha");
  }
  if (value.environment !== null && typeof value.environment !== "string") {
    throw new Error("version response has an invalid environment");
  }
  return {
    commitSha: value.commitSha as string | null,
    environment: value.environment as string | null,
  };
}

export function verifyPreview(
  expectedDevelopCommit: string,
  version: VersionResponse,
): string[] {
  const reasons: string[] = [];
  if (!version.commitSha) {
    reasons.push("preview deployment did not report a commit identity");
  } else if (version.commitSha !== expectedDevelopCommit) {
    reasons.push(
      `preview identity ${version.commitSha} does not match develop commit ${expectedDevelopCommit}`,
    );
  }
  if (version.environment !== "preview") {
    reasons.push(`preview deployment reported environment ${version.environment ?? "null"}`);
  }
  return reasons;
}

export function verifyPromotion(
  candidateTreeDigest: string,
  mainCommit: string,
  mainTreeDigest: string,
): string[] {
  const reasons: string[] = [];
  if (!shaPattern.test(mainCommit)) {
    reasons.push("main commit must be a full 40-character Git SHA");
  }
  if (!shaPattern.test(candidateTreeDigest) || !shaPattern.test(mainTreeDigest)) {
    reasons.push("candidate and main tree digests must be full 40-character Git SHAs");
  } else if (mainTreeDigest !== candidateTreeDigest) {
    reasons.push(
      `main tree ${mainTreeDigest} does not match candidate tree ${candidateTreeDigest}`,
    );
  }
  return reasons;
}

export function verifyProduction(
  expectedMainCommit: string,
  version: VersionResponse,
): string[] {
  const reasons: string[] = [];
  if (!version.commitSha) {
    reasons.push("production deployment did not report a commit identity");
  } else if (version.commitSha !== expectedMainCommit) {
    reasons.push(
      `production identity ${version.commitSha} does not match main commit ${expectedMainCommit}`,
    );
  }
  if (version.environment !== "production") {
    reasons.push(`production deployment reported environment ${version.environment ?? "null"}`);
  }
  return reasons;
}

export async function fetchVersionResponse(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  vercelAutomationBypassSecret?: string,
): Promise<VersionResponse> {
  let url: URL;
  try {
    url = new URL("/api/version", baseUrl);
  } catch {
    throw new Error(`invalid deployment URL: ${baseUrl}`);
  }
  let response: Response;
  try {
    response = await fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: "application/json",
        ...(vercelAutomationBypassSecret
          ? { "x-vercel-protection-bypass": vercelAutomationBypassSecret }
          : {}),
      },
    });
  } catch (error) {
    throw new Error(
      `deployment identity request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`deployment identity request redirected with status ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`deployment identity request failed with status ${response.status}`);
  }
  return parseVersionResponse(await response.text());
}

export function previewProtectionBypassSecret(
  requestedBaseUrl: string,
  candidatePreviewUrl: string,
  secret?: string,
): string | undefined {
  if (!secret) return undefined;
  try {
    return new URL(requestedBaseUrl).toString() ===
      new URL(candidatePreviewUrl).toString()
      ? secret
      : undefined;
  } catch {
    return undefined;
  }
}

function argument(name: string, required = true): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (required && !value) throw new Error(`missing required argument ${name}`);
  return value;
}

export type CandidateFile = {
  developCommit: string;
  candidateTreeDigest: string;
  previewUrl: string;
  mainCommit?: string;
  productionUrl?: string;
};

export type IdentityAdapters = {
  fetchVersion: (baseUrl: string) => Promise<VersionResponse>;
  resolveTree: (commit: string) => Promise<string> | string;
};

export async function verifyCandidateIdentity(
  candidate: CandidateFile,
  promotion: { mainCommit?: string; productionUrl?: string },
  adapters: IdentityAdapters,
): Promise<{ evidence: Record<string, unknown>; blockingReasons: string[] }> {
  const preview = await adapters.fetchVersion(candidate.previewUrl);
  const blockingReasons = verifyPreview(candidate.developCommit, preview);
  const evidence: Record<string, unknown> = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    preview,
  };

  const mainCommit = promotion.mainCommit ?? candidate.mainCommit;
  const productionUrl = promotion.productionUrl ?? candidate.productionUrl;
  if (mainCommit || productionUrl) {
    if (!mainCommit || !productionUrl) {
      blockingReasons.push("main commit and production URL must be supplied together");
    } else {
      const mainTree = (await adapters.resolveTree(mainCommit)).trim();
      blockingReasons.push(
        ...verifyPromotion(candidate.candidateTreeDigest, mainCommit, mainTree),
      );
      const production = await adapters.fetchVersion(productionUrl);
      blockingReasons.push(...verifyProduction(mainCommit, production));
      evidence.mainCommit = mainCommit;
      evidence.mainTreeDigest = mainTree;
      evidence.production = production;
    }
  }
  evidence.decision = blockingReasons.length === 0 ? "pass" : "blocked";
  evidence.blockingReasons = blockingReasons;
  return { evidence, blockingReasons };
}

export async function main(): Promise<void> {
  const candidatePath = argument("--candidate")!;
  const candidate = JSON.parse(readFileSync(candidatePath, "utf8")) as CandidateFile;
  const mainCommit = argument("--main-commit", false) ?? candidate.mainCommit;
  const productionUrl = argument("--production-url", false) ?? candidate.productionUrl;
  const vercelAutomationBypassSecret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

  const { evidence, blockingReasons } = await verifyCandidateIdentity(
    candidate,
    { mainCommit, productionUrl },
    {
      fetchVersion: (baseUrl) =>
        fetchVersionResponse(
          baseUrl,
          fetch,
          previewProtectionBypassSecret(
            baseUrl,
            candidate.previewUrl,
            vercelAutomationBypassSecret,
          ),
        ),
      resolveTree: (commit) =>
        execFileSync("git", ["rev-parse", `${commit}^{tree}`], {
        encoding: "utf8",
        }),
    },
  );
  const output =
    argument("--output", false) ?? join(dirname(candidatePath), "identity-evidence.json");
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);

  if (blockingReasons.length > 0) {
    throw new Error(blockingReasons.join("\n"));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

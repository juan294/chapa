import { describe, expect, it } from "vitest";
import {
  fetchVersionResponse,
  parseVersionResponse,
  previewProtectionBypassSecret,
  verifyCandidateIdentity,
  verifyPreview,
  verifyProduction,
  verifyPromotion,
} from "./verify-deployment-identity";

const developCommit = "a".repeat(40);
const mainCommit = "b".repeat(40);
const candidateTree = "c".repeat(40);

describe("deployment identity verification", () => {
  it("rejects missing URLs and network failures", async () => {
    await expect(
      fetchVersionResponse("", async () => new Response("{}")),
    ).rejects.toThrow("invalid deployment URL");
    await expect(
      fetchVersionResponse("https://preview.example.com", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("deployment identity request failed: offline");
  });

  it("rejects redirects and malformed JSON from deployments", async () => {
    await expect(
      fetchVersionResponse(
        "https://preview.example.com",
        async () => new Response("", { status: 302 }),
      ),
    ).rejects.toThrow("redirected with status 302");
    await expect(
      fetchVersionResponse(
        "https://preview.example.com",
        async () => new Response("not json", { status: 200 }),
      ),
    ).rejects.toThrow("version response is not valid JSON");
  });

  it("sends a configured Vercel protection bypass secret as a header", async () => {
    const requests: RequestInit[] = [];
    await fetchVersionResponse(
      "https://preview.example.com",
      async (_url, init) => {
        requests.push(init ?? {});
        return new Response(
          JSON.stringify({ commitSha: developCommit, environment: "preview" }),
          { status: 200 },
        );
      },
      "preview-secret",
    );

    expect(new Headers(requests[0]?.headers).get("x-vercel-protection-bypass")).toBe(
      "preview-secret",
    );
  });

  it("selects the bypass secret only for the exact candidate preview URL", () => {
    expect(
      previewProtectionBypassSecret(
        "https://preview.example.com",
        "https://preview.example.com/",
        "preview-secret",
      ),
    ).toBe("preview-secret");
    expect(
      previewProtectionBypassSecret(
        "https://chapa.example.com",
        "https://preview.example.com/",
        "preview-secret",
      ),
    ).toBeUndefined();
  });

  it("accepts the exact preview deployment identity", () => {
    expect(
      verifyPreview(developCommit, {
        commitSha: developCommit,
        environment: "preview",
      }),
    ).toEqual([]);
  });

  it("blocks null, stale, and wrong-environment preview identities", () => {
    expect(
      verifyPreview(developCommit, {
        commitSha: null,
        environment: "preview",
      }),
    ).toContain("preview deployment did not report a commit identity");
    expect(
      verifyPreview(developCommit, {
        commitSha: mainCommit,
        environment: "preview",
      }),
    ).toContain(`preview identity ${mainCommit} does not match develop commit ${developCommit}`);
    expect(
      verifyPreview(developCommit, {
        commitSha: developCommit,
        environment: "production",
      }),
    ).toContain("preview deployment reported environment production");
  });

  it("accepts a squash promotion with the same tree", () => {
    expect(verifyPromotion(candidateTree, mainCommit, candidateTree)).toEqual([]);
  });

  it("blocks malformed main commits and changed promotion trees", () => {
    expect(verifyPromotion(candidateTree, "main", candidateTree)).toContain(
      "main commit must be a full 40-character Git SHA",
    );
    expect(verifyPromotion(candidateTree, mainCommit, "d".repeat(40))).toContain(
      `main tree ${"d".repeat(40)} does not match candidate tree ${candidateTree}`,
    );
  });

  it("accepts the exact production deployment identity", () => {
    expect(
      verifyProduction(mainCommit, {
        commitSha: mainCommit,
        environment: "production",
      }),
    ).toEqual([]);
  });

  it("orchestrates preview, fake Git tree, and production identity", async () => {
    const requestedUrls: string[] = [];
    const requestedCommits: string[] = [];
    const result = await verifyCandidateIdentity(
      {
        developCommit,
        candidateTreeDigest: candidateTree,
        previewUrl: "https://preview.example.test",
      },
      {
        mainCommit,
        productionUrl: "https://production.example.test",
      },
      {
        fetchVersion: async (url) => {
          requestedUrls.push(url);
          return url.includes("preview")
            ? { commitSha: developCommit, environment: "preview" }
            : { commitSha: mainCommit, environment: "production" };
        },
        resolveTree: async (commit) => {
          requestedCommits.push(commit);
          return candidateTree;
        },
      },
    );

    expect(result.blockingReasons).toEqual([]);
    expect(result.evidence).toMatchObject({
      decision: "pass",
      mainCommit,
      mainTreeDigest: candidateTree,
    });
    expect(requestedUrls).toEqual([
      "https://preview.example.test",
      "https://production.example.test",
    ]);
    expect(requestedCommits).toEqual([mainCommit]);
  });

  it("blocks stale production aliases", () => {
    expect(
      verifyProduction(mainCommit, {
        commitSha: developCommit,
        environment: "production",
      }),
    ).toContain(`production identity ${developCommit} does not match main commit ${mainCommit}`);
  });

  it("rejects malformed version responses", () => {
    expect(() => parseVersionResponse("not json")).toThrow("version response is not valid JSON");
    expect(() => parseVersionResponse('{"commitSha":42}')).toThrow(
      "version response has an invalid commitSha",
    );
  });
});

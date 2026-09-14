import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyServedCandidateArtifact } from "./local-candidate-artifact";
const bytes = Buffer.from("console.log('built candidate')");
const artifact = { path: "apps/web/.next/static/chunks/app/page-abcdef.js", sha256: createHash("sha256").update(bytes).digest("hex") };
describe("local server must serve the qualified build", () => {
  it("checks a manifest-bound static code artifact on the local target", async () => {
    const get = vi.fn().mockResolvedValue({ status: () => 200, body: async () => bytes });
    await expect(verifyServedCandidateArtifact([artifact], get)).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledWith("/_next/static/chunks/app/page-abcdef.js", { maxRedirects: 0 });
  });
  it("checks every static code artifact rather than accepting one shared chunk", async () => {
    const get = vi.fn().mockResolvedValueOnce({ status: () => 200, body: async () => bytes }).mockResolvedValueOnce({ status: () => 200, body: async () => Buffer.from("different second chunk") });
    await expect(verifyServedCandidateArtifact([artifact, { ...artifact, path: "apps/web/.next/static/qualified-build/_buildManifest.js" }], get)).rejects.toThrow(/digest/);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it("rejects another production server's bytes", async () => {
    await expect(verifyServedCandidateArtifact([artifact], vi.fn().mockResolvedValue({ status: () => 200, body: async () => Buffer.from("other build") }))).rejects.toThrow(/digest/);
  });
  it("rejects redirects and an artifact manifest without actual static code", async () => {
    await expect(verifyServedCandidateArtifact([artifact], vi.fn().mockResolvedValue({ status: () => 302 }))).rejects.toThrow(/response/);
    await expect(verifyServedCandidateArtifact([{ path: "apps/web/.next/BUILD_ID", sha256: artifact.sha256 }], vi.fn())).rejects.toThrow(/static/);
  });
});

import { createHash } from "node:crypto";

type Artifact = { path: string; sha256: string };
type ReadResponse = { status(): number; body(): Promise<Buffer> };
/** Compare all served static code, including the build-ID-scoped manifest when
 * present, against the already verified local artifact manifest. */
export async function verifyServedCandidateArtifact(artifacts: readonly Artifact[], get: (path: string, options: { maxRedirects: number }) => Promise<ReadResponse>): Promise<void> {
  const prefix = "apps/web/.next/static/";
  const code = artifacts.filter(artifact => artifact.path.startsWith(prefix) && artifact.path.endsWith(".js"));
  if (code.length === 0) throw new Error("Local candidate manifest requires actual static code");
  for (const artifact of code) {
    const response = await get(`/_next/static/${artifact.path.slice(prefix.length)}`, { maxRedirects: 0 });
    if (response.status() !== 200) throw new Error("Local candidate static artifact response must be 200 without redirects");
    if (createHash("sha256").update(await response.body()).digest("hex") !== artifact.sha256) throw new Error("Served candidate static artifact digest differs from qualified build");
  }
}

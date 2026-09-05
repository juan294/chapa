/** Executable local producer fixture. Default is dry-run; --send makes one authenticated request. */
import { readFile, stat } from "node:fs/promises";
import { parseArgs } from "node:util";
import { scoringInstant } from "@chapa/shared";
import { parseSupplementalEvidenceV2, type SupplementalEvidenceV2 } from "../apps/web/lib/platform/evidence-aging";

export function buildSupplementalFixture(target: string, sourceHandle: string, referenceTime: string): SupplementalEvidenceV2 {
  const time = scoringInstant(referenceTime).getTime();
  const occurred = new Date(time - 86400000).toISOString();
  const through = new Date(time).toISOString();
  const subject = `fixture:${sourceHandle}`;
  return parseSupplementalEvidenceV2({
    schemaVersion: "supplemental-v2", targetHandle: target,
    source: { provider: "github", host: "github.com", subjectId: subject, handle: sourceHandle },
    observationPeriod: { startInclusive: new Date(time - 2 * 86400000).toISOString(), endExclusive: through }, observedThrough: through,
    events: [{ eventId: "fixture-merge-1", repositoryId: "fixture-repository-1", actorId: subject, workItemId: "fixture-pr-1",
      kind: "accepted_change", occurredAt: occurred, artifactRevision: "fixture-revision-1", files: ["README.md"], additions: 1, deletions: 0,
      acceptance: { method: "merged_change", acceptedAt: occurred, acceptedResultId: "fixture-merge-1" } }],
  }, target, referenceTime);
}
export async function sendSupplementalEvidence(baseUrl: string, token: string, value: unknown, fetcher: typeof fetch = fetch): Promise<unknown> {
  const url = new URL(baseUrl);
  if (!token.trim() || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) {
    throw new Error("Use an HTTPS origin or local HTTP origin without credentials, path, query or fragment; supply a CLI token separately");
  }
  url.pathname = "/api/supplemental";
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).length > 262144) throw new Error("Supplemental upload exceeds 256 KiB");
  const response = await fetcher(url.toString(), { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body });
  if (!response.ok) throw new Error(`Supplemental upload failed (${response.status})`);
  return response.json();
}
async function run(args: readonly string[]): Promise<void> {
  const { values } = parseArgs({ args: [...args], options: {
    fixture: { type: "boolean" }, target: { type: "string" }, source: { type: "string" }, reference: { type: "string" },
    file: { type: "string" }, send: { type: "boolean", default: false }, "base-url": { type: "string", default: "http://127.0.0.1:3000" },
  } });
  let value: unknown;
  if (values.fixture && !values.file && values.target && values.source && values.reference) {
    value = buildSupplementalFixture(values.target, values.source, values.reference);
  } else if (values.file && !values.fixture) {
    if ((await stat(values.file)).size > 262144) throw new Error("Supplemental upload exceeds 256 KiB");
    value = JSON.parse(await readFile(values.file, "utf8"));
  } else {
    throw new Error("Use --fixture --target HANDLE --source WORK_HANDLE --reference RFC3339, or --file PATH. Default is dry-run; --send requires CHAPA_CLI_TOKEN.");
  }
  if (!values.send) { console.log(JSON.stringify(value, null, 2)); return; }
  const token = process.env.CHAPA_CLI_TOKEN;
  if (!token) throw new Error("Set CHAPA_CLI_TOKEN for --send; the client does not read an env file");
  console.log(JSON.stringify(await sendSupplementalEvidence(values["base-url"]!, token, value)));
}
const direct = Boolean(process.argv[1]?.endsWith("supplemental-evidence-client.ts"));
if (direct) run(process.argv.slice(2)).catch(error => {
  console.error(error instanceof Error ? error.message : "Supplemental client failed");
  process.exitCode = 1;
});

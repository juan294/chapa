import { canonicalJson, canonicalSha256, type EngineeringEvidenceInput, type PublicObservedCraft, type PublicObservedScoringReceipt } from "@chapa/shared";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdtemp, open, rm, statfs, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

/** These normalized-evidence arrays are sets, not ordered policy rules. Sort
 * before projectReceiptEvidence allocates source/work ordinals. Never apply
 * this transform to a receipt's algorithm rules (e.g. archetype tie order).
 */
function orderedEvidence(value: unknown): unknown {
  if (Array.isArray(value)) {
    const keyed = value.map(item => orderedEvidence(item)).map(item => [canonicalJson(item), item] as const);
    return [...new Map(keyed).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item);
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, orderedEvidence(item)]));
  return value;
}

export function canonicalizeReceiptEvidence(input: EngineeringEvidenceInput): EngineeringEvidenceInput {
  return orderedEvidence(input) as EngineeringEvidenceInput;
}

/** Private storage identity, never a public report/work identity. Excludes
 * allocated envelope lineage and incidental caller window references only.
 *
 * projectEngineeringLedger currently stamps its projected coverage and event
 * dataThrough with the caller's referenceTime. Normalize ONLY that demonstrably
 * synthetic value for the registered ledger. Genuine provider dataThrough,
 * actual ledger recordedAt/assessedAt, report periods and historical windows
 * remain part of identity. The returned digest belongs in service-only storage.
 */
export async function receiptSemanticIdentity(receipt: PublicObservedScoringReceipt, evidence: EngineeringEvidenceInput, privateLedgerIdentity: unknown = null): Promise<string> {
  const referenceTime = receipt.window.referenceTime;
  function normalize(value: unknown, key = ""): unknown {
    if (Array.isArray(value)) return value.map(item => normalize(item));
    if (!value || typeof value !== "object") return value;
    const row = value as Record<string, unknown>;
    const syntheticLedger = row.dataThrough === referenceTime && (
      (row.provider === "portfolio" && row.discovery === "registered_ledger")
      || (row.provider === "portfolio" && row.host === "ledger.chapa")
      || (row.discovery === "registered_ledger" && typeof row.source === "object" && row.source !== null
        && (row.source as Record<string, unknown>).provider === "portfolio" && (row.source as Record<string, unknown>).host === "ledger.chapa"));
    return Object.fromEntries(Object.entries(row)
      .filter(([name]) => !(key === "window" && row.referenceDate === receipt.window.referenceDate && name === "referenceTime"))
      .map(([name, item]) => [name, syntheticLedger && name === "dataThrough" ? "synthetic-ledger-reference" : normalize(item, name)]));
  }
  const { receiptId: _family, revisionId: _revisionId, revision: _revision, supersedesRevisionId: _supersedes, recordedAt: _recordedAt, action: _action, ...semantic } = receipt;
  void _family; void _revisionId; void _revision; void _supersedes; void _recordedAt; void _action;
  return canonicalSha256({ receipt: normalize(semantic), retracted: receipt.action === "retract", evidence: normalize(canonicalizeReceiptEvidence(evidence)), ledger: orderedEvidence(privateLedgerIdentity) });
}

/** Private external sort. Add all pages, consume scorerSortedEvents to
 * completion if scoring needs it, then calculate the digest. Digest preparation
 * replaces the raw scorer runs with canonical runs, so scorer traversal cannot
 * follow it. Always dispose the spool, including on failure or cancellation.
 */
export async function beginCanonicalReceiptEvidenceSpool(options: { runBytes?: number; maxScratchBytes?: number } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "chapa-receipt-evidence-"));
  await chmod(directory, 0o700);
  const runs: string[] = [];
  const scorerRuns: string[] = [];
  let buffered: string[] = [];
  let bufferedBytes = 0;
  let scorerBuffered: string[] = [];
  let scorerBufferedBytes = 0;
  let nextRun = 0;
  let disposed = false;
  let sealed = false;
  let digestPrepared = false;
  let scorerReadComplete = false;
  let scorerReadStarted = false;
  let diskBytes = 0;
  let peakDiskBytes = 0;
  const fileBytes = new Map<string, number>();
  const RUN_BYTES = options.runBytes ?? 8 * 1024 * 1024;
  const MAX_SCRATCH_BYTES = options.maxScratchBytes ?? 384 * 1024 * 1024;
  const MERGE_FAN_IN = 64;
  if (!Number.isSafeInteger(RUN_BYTES) || RUN_BYTES < 1_024 || !Number.isSafeInteger(MAX_SCRATCH_BYTES) || MAX_SCRATCH_BYTES < RUN_BYTES) {
    await rm(directory, { recursive: true, force: true });
    throw new RangeError("Invalid receipt evidence spool budget");
  }

  function assertOpen() {
    if (disposed) throw new Error("Receipt evidence spool is disposed");
  }
  function recordWrite(path: string, bytes: number) {
    fileBytes.set(path, (fileBytes.get(path) ?? 0) + bytes);
    diskBytes += bytes;
    peakDiskBytes = Math.max(peakDiskBytes, diskBytes);
  }
  async function ensureScratchRoom(bytes: number) {
    if (diskBytes + bytes > MAX_SCRATCH_BYTES) throw new RangeError("Receipt evidence spool scratch budget exceeded");
    const filesystem = await statfs(directory);
    if (filesystem.bavail * filesystem.bsize < bytes + 32 * 1024 * 1024) {
      throw new RangeError("Receipt evidence spool scratch space unavailable");
    }
  }
  async function removeRun(path: string) {
    await rm(path);
    diskBytes -= fileBytes.get(path) ?? 0;
    fileBytes.delete(path);
  }
  async function flush(score = false) {
    const values = score ? scorerBuffered : buffered;
    if (!values.length) return;
    const path = join(directory, `run-${nextRun++}.jsonl`);
    const keys = [...new Set(values)].sort();
    const output = `${keys.join("\n")}\n`;
    await ensureScratchRoom(Buffer.byteLength(output, "utf8"));
    await writeFile(path, output, { flag: "wx", mode: 0o600 });
    recordWrite(path, Buffer.byteLength(output, "utf8"));
    if (score) {
      scorerRuns.push(path);
      scorerBuffered = [];
      scorerBufferedBytes = 0;
    } else {
      runs.push(path);
      buffered = [];
      bufferedBytes = 0;
    }
  }
  // This is the scorer's legacy full-value ordering, independent of the
  // canonical private digest's recursively sorted evidence arrays.
  function scorerStable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(scorerStable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${scorerStable(item)}`).join(",")}}`;
    return JSON.stringify(value);
  }
  async function addPage(events: readonly EngineeringEvidenceInput["events"][number][]) {
    assertOpen();
    if (sealed) throw new Error("Receipt evidence spool is sealed");
    for (const event of events) {
      canonicalJson(event); // Preserve the digest's finite-JSON validation at ingestion.
      const scorerKey = scorerStable(event);
      scorerBuffered.push(scorerKey);
      scorerBufferedBytes += Buffer.byteLength(scorerKey, "utf8") + 1;
      if (scorerBufferedBytes >= RUN_BYTES) await flush(true);
    }
  }
  async function* merge(paths: readonly string[]): AsyncGenerator<string> {
    const streams = paths.map(path => createReadStream(path, { encoding: "utf8" }));
    const readers = streams.map(stream => createInterface({ input: stream, crlfDelay: Infinity }));
    const iterators = readers.map(reader => reader[Symbol.asyncIterator]());
    try {
      const heads = await Promise.all(iterators.map(iterator => iterator.next()));
      let previous: string | undefined;
      while (true) {
        let selected = -1;
        for (let index = 0; index < heads.length; index++) {
          if (heads[index]!.done) continue;
          if (selected < 0 || heads[index]!.value! < heads[selected]!.value!) selected = index;
        }
        if (selected < 0) break;
        const key = heads[selected]!.value!;
        if (key !== previous) yield key;
        previous = key;
        heads[selected] = await iterators[selected]!.next();
      }
    } finally {
      readers.forEach(reader => reader.close());
      streams.forEach(stream => stream.destroy());
    }
  }
  async function writeMerged(paths: readonly string[]): Promise<string> {
    const path = join(directory, `run-${nextRun++}.jsonl`);
    const file = await open(path, "wx", 0o600);
    try {
      let output = "";
      for await (const key of merge(paths)) {
        output += `${key}\n`;
        if (Buffer.byteLength(output, "utf8") >= 512 * 1024) {
          await ensureScratchRoom(Buffer.byteLength(output, "utf8"));
          await file.writeFile(output);
          recordWrite(path, Buffer.byteLength(output, "utf8"));
          output = "";
        }
      }
      if (output) {
        await ensureScratchRoom(Buffer.byteLength(output, "utf8"));
        await file.writeFile(output);
        recordWrite(path, Buffer.byteLength(output, "utf8"));
      }
    } finally {
      await file.close();
    }
    return path;
  }
  async function prepareRuns(score = false) {
    assertOpen();
    sealed = true;
    if (!score && !digestPrepared) {
      if (scorerReadStarted && !scorerReadComplete) throw new Error("Scorer event traversal is incomplete");
      await prepareRuns(true);
      // Rekey one raw run at a time, then remove it. Scratch space stays near
      // one complete corpus plus a single bounded run during conversion.
      for (const path of scorerRuns.splice(0)) {
        for await (const raw of merge([path])) {
          const key = canonicalJson(orderedEvidence(JSON.parse(raw)));
          buffered.push(key);
          bufferedBytes += Buffer.byteLength(key, "utf8") + 1;
          if (bufferedBytes >= RUN_BYTES) await flush();
        }
        await removeRun(path);
      }
      digestPrepared = true;
    }
    await flush(score);
    const list = score ? scorerRuns : runs;
    while (list.length > MERGE_FAN_IN) {
      const old = list.splice(0, MERGE_FAN_IN);
      const combined = await writeMerged(old);
      list.push(combined);
      await Promise.all(old.map(path => removeRun(path)));
    }
  }
  /** Ordered/deduplicated by the digest's canonical pre-normalization key. */
  async function* sortedEvents(): AsyncGenerator<EngineeringEvidenceInput["events"][number]> {
    await prepareRuns();
    for await (const key of merge(runs)) yield JSON.parse(key) as EngineeringEvidenceInput["events"][number];
  }
  /** Ordered/deduplicated by mergeEngineeringEvidence's legacy stable key. */
  async function* scorerSortedEvents(): AsyncGenerator<EngineeringEvidenceInput["events"][number]> {
    if (digestPrepared) throw new Error("Scorer event traversal must precede digest preparation");
    if (scorerReadStarted) throw new Error("Scorer event traversal already started");
    scorerReadStarted = true;
    await prepareRuns(true);
    for await (const key of merge(scorerRuns)) yield JSON.parse(key) as EngineeringEvidenceInput["events"][number];
    scorerReadComplete = true;
  }

  async function* canonicalChunks(
    receipt: PublicObservedScoringReceipt,
    evidenceWithoutEvents: Omit<EngineeringEvidenceInput, "events">,
    privateLedgerIdentity: unknown = null,
  ): AsyncGenerator<string> {
    await prepareRuns();
    const referenceTime = receipt.window.referenceTime;
    function normalize(value: unknown, key = ""): unknown {
      if (Array.isArray(value)) return value.map(item => normalize(item));
      if (!value || typeof value !== "object") return value;
      const row = value as Record<string, unknown>;
      const syntheticLedger = row.dataThrough === referenceTime && (
        (row.provider === "portfolio" && row.discovery === "registered_ledger")
        || (row.provider === "portfolio" && row.host === "ledger.chapa")
        || (row.discovery === "registered_ledger" && typeof row.source === "object" && row.source !== null
          && (row.source as Record<string, unknown>).provider === "portfolio" && (row.source as Record<string, unknown>).host === "ledger.chapa"));
      return Object.fromEntries(Object.entries(row)
        .filter(([name]) => !(key === "window" && row.referenceDate === receipt.window.referenceDate && name === "referenceTime"))
        .map(([name, item]) => [name, syntheticLedger && name === "dataThrough" ? "synthetic-ledger-reference" : normalize(item, name)]));
    }
    const { receiptId: _family, revisionId: _revisionId, revision: _revision, supersedesRevisionId: _supersedes, recordedAt: _recordedAt, action: _action, ...semantic } = receipt;
    void _family; void _revisionId; void _revision; void _supersedes; void _recordedAt; void _action;
    const normalizedMetadata = normalize(orderedEvidence(evidenceWithoutEvents)) as Record<string, unknown>;
    yield '{"evidence":{';
    let firstField = true;
    for (const field of [...Object.keys(normalizedMetadata), "events"].sort()) {
      if (!firstField) yield ",";
      firstField = false;
      yield `${canonicalJson(field)}:`;
      if (field !== "events") {
        yield canonicalJson(normalizedMetadata[field]);
        continue;
      }
      yield "[";
      let firstEvent = true;
      for await (const event of sortedEvents()) {
        if (!firstEvent) yield ",";
        firstEvent = false;
        yield canonicalJson(normalize(event));
      }
      yield "]";
    }
    yield '},"ledger":';
    yield canonicalJson(orderedEvidence(privateLedgerIdentity));
    yield ',"receipt":';
    yield canonicalJson(normalize(semantic));
    yield ',"retracted":';
    yield receipt.action === "retract" ? "true}" : "false}";
  }
  async function digest(
    receipt: PublicObservedScoringReceipt,
    evidenceWithoutEvents: Omit<EngineeringEvidenceInput, "events">,
    privateLedgerIdentity: unknown = null,
  ): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of canonicalChunks(receipt, evidenceWithoutEvents, privateLedgerIdentity)) hash.update(chunk, "utf8");
    return hash.digest("hex");
  }
  async function dispose() {
    if (disposed) return;
    disposed = true;
    await rm(directory, { recursive: true, force: true });
  }
  function scratchStats() {
    return { currentDiskBytes: diskBytes, peakDiskBytes, bufferedBytes: bufferedBytes + scorerBufferedBytes, runCount: runs.length + scorerRuns.length };
  }
  return { addPage, sortedEvents, scorerSortedEvents, canonicalChunks, digest, scratchStats, dispose };
}

/** Compose the private core identity with current Craft. The evaluation clock
 * inside current report inputs is incidental within its recorded UTC date;
 * genuine report periods and historical lastReport windows remain untouched.
 */
export async function observedSemanticIdentity(coreSemanticDigest: string, craft: PublicObservedCraft): Promise<string> {
  let semanticCraft: unknown = craft;
  if (craft.status === "scored" || craft.status === "insufficient_report_data") {
    const { referenceTime, ...window } = craft.report.inputs.window;
    void referenceTime;
    semanticCraft = { ...craft, report: { ...craft.report, inputs: { ...craft.report.inputs, window } } };
  }
  return canonicalSha256({ coreSemanticDigest, craft: semanticCraft });
}

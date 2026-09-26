import { classifyDocumentationFiles, mergeEngineeringEvidence } from "./scoring-aggregation-v7";
import type { EngineeringEvidenceInput, NormalizedEngineeringEvent, Observation } from "./scoring-evidence";

/** Match the private stable ordering used by mergeEngineeringEvidence. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Map(values.map(value => [stable(value), value])).entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([, value]) => value);
}

function compactFiles(files: Observation<readonly string[]>, identity: number): Observation<readonly string[]> {
  if (files.status === "unknown") return files;
  const docs = classifyDocumentationFiles(files);
  if (!files.value.length) return { ...files, value: [] };
  return { ...files, value: docs.status === "observed" && docs.value
    ? [`docs/file-${identity}.md`] : [`src/file-${identity}.ts`] };
}

/** A scorer-only input. Its distinct surrogate file paths preserve the exact
 * normalized equality of original lists, including conflicts across works. */
export interface EngineeringAggregationReducer {
  /** Requires legacy stable(rawEvent) order across every page. */
  addSortedPage(page: readonly NormalizedEngineeringEvent[]): void;
  finish(): EngineeringEvidenceInput;
}

export function beginEngineeringAggregationV7(meta: Omit<EngineeringEvidenceInput, "events">): EngineeringAggregationReducer {
  const normalizedMeta = mergeEngineeringEvidence({ ...meta, events: [] });
  const compactEvents: NormalizedEngineeringEvent[] = [];
  const fileIdentities = new Map<string, number>();
  let previousToken: string | null = null;
  let finished = false;
  return {
    addSortedPage(page) {
      if (finished) throw new RangeError("Cannot add evidence after finish");
      for (const event of page) {
        const token = stable(event);
        if (previousToken !== null && token < previousToken) throw new RangeError("Engineering evidence pages must be scorer sorted");
        if (token === previousToken) continue;
        previousToken = token;
        const originalFiles = event.measurements.changedFiles;
        const files = originalFiles.status === "observed"
          ? { ...originalFiles, value: unique(originalFiles.value) } : originalFiles;
        const fileToken = files.status === "observed" ? stable(files.value) : null;
        let fileIdentity = fileToken === null ? 0 : fileIdentities.get(fileToken);
        if (fileToken !== null && fileIdentity === undefined) {
          fileIdentity = fileIdentities.size + 1;
          fileIdentities.set(fileToken, fileIdentity);
        }
        compactEvents.push({ ...event,
          measurements: { ...event.measurements, changedFiles: compactFiles(files, fileIdentity ?? 0) } });
      }
    },
    finish() {
      if (finished) throw new RangeError("Engineering evidence reducer already finished");
      finished = true;
      fileIdentities.clear();
      return { ...normalizedMeta, events: compactEvents };
    },
  };
}

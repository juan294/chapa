import { createScoringWindow, observed, unknown } from "@chapa/shared";
import type { NormalizedEngineeringEvent, ScoringWindow, SourceIdentity } from "@chapa/shared";

/** Synthetic provider data for the local collection benchmark. No live identities or I/O. */
export interface SyntheticCollectionFixtureOptions {
  readonly count: number;
  readonly seed: number;
  readonly window?: ScoringWindow;
}

export const SYNTHETIC_COLLECTION_WINDOW = createScoringWindow("2026-09-26T12:00:00.000Z");

export function syntheticCollectionSource(seed: number): SourceIdentity {
  if (!Number.isSafeInteger(seed)) throw new RangeError("Fixture seed must be a safe integer");
  return { provider: "github", host: "github.com", subjectId: `synthetic-subject-${seed}` };
}

function randomStream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
}

const yes = <T>(value: T) => observed(value, "complete", "source_observed");

/** Seven commits, two merged changes and one review per ten events. */
export function syntheticCollectionEvents({
  count, seed, window = SYNTHETIC_COLLECTION_WINDOW,
}: SyntheticCollectionFixtureOptions): NormalizedEngineeringEvent[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("Fixture count must be a nonnegative safe integer");
  const source = syntheticCollectionSource(seed);
  const random = randomStream(seed);
  const start = Date.parse(window.startInclusive);
  const events: NormalizedEngineeringEvent[] = [];

  for (let index = 0; index < count; index++) {
    const cohort = Math.floor(index / 10);
    const slot = index % 10;
    const kind = slot < 7 ? "authored_commit" : slot < 9 ? "accepted_change" : "review";
    const id = index.toString(36).padStart(8, "0");
    const repositoryId = `synthetic-repo-${(cohort * 7 + seed) % 24}`;
    const projectId = `github:${repositoryId}`;
    const workItemId = kind === "authored_commit" ? `synthetic-commit-${id}` : `synthetic-pr-${cohort}-${slot === 8 ? 1 : 0}`;
    const occurredAt = new Date(start + (random() % 364) * 86_400_000 + 12 * 3_600_000).toISOString();
    const artifactId = `synthetic-artifact-${kind}-${id}-${random().toString(16).padStart(8, "0")}`;
    const changedFiles = kind === "accepted_change"
      ? Array.from({ length: 12 + random() % 5 }, (_, fileIndex) =>
          `packages/synthetic-project-${repositoryId}/src/module-${cohort % 17}/feature-${id}-${fileIndex.toString().padStart(2, "0")}.ts`)
      : null;
    const measurements = {
      changedFiles: changedFiles ? yes(changedFiles) : unknown("unavailable", "not_supported"),
      additions: kind === "review" ? unknown("unavailable", "not_supported") : yes(1 + random() % 900),
      deletions: kind === "review" ? unknown("unavailable", "not_supported") : yes(random() % 300),
      leadTimeHours: kind === "accepted_change" ? yes(1 + random() % 240) : unknown("unavailable", "not_supported"),
      hasDescription: kind === "accepted_change" ? yes(random() % 5 !== 0) : unknown("unavailable", "not_supported"),
      hasIssueLink: kind === "accepted_change" ? yes(random() % 3 === 0) : unknown("unavailable", "not_supported"),
      usesFeatureBranch: unknown("unavailable", "not_supported"),
    };
    events.push({
      ...source, repositoryId, actorId: source.subjectId,
      eventId: `synthetic-${kind}-${id}`, schemaVersion: "v7", kind,
      occurredAt, dataThrough: window.referenceTime, canonicalProjectId: projectId,
      workItemId, artifactRevision: `synthetic-revision-${id}-${random().toString(16).padStart(8, "0")}`,
      artifactReferenceIds: [artifactId], attribution: "individual", provenance: "source_observed", coverage: "complete",
      measurements, categories: kind === "accepted_change" ? [{ category: "implementation", evidenceReferenceIds: [artifactId] }] : [],
      acceptance: kind === "accepted_change"
        ? yes({ method: "merged_change", acceptedAt: occurredAt, acceptedResultId: `synthetic-result-${id}` })
        : unknown("unavailable", "not_supported"),
    });
  }
  return events;
}

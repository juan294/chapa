import type { ScenarioResult } from "./contracts";

export function mergeScenarioResults(
  results: ScenarioResult[],
): ScenarioResult {
  if (results.length === 0) {
    throw new Error("cannot merge zero scenario results");
  }
  const first = results[0]!;
  if (
    results.some(
      (result) =>
        result.scenarioId !== first.scenarioId ||
        result.environment !== first.environment,
    )
  ) {
    throw new Error("cannot merge different scenario/environment results");
  }
  const statuses = new Set(results.map((result) => result.status));
  const status =
    statuses.size === 1
      ? first.status
      : "failed";
  const evidence: Record<string, string[]> = {};
  for (const result of results) {
    for (const [oracle, paths] of Object.entries(result.evidence)) {
      evidence[oracle] = [...new Set([...(evidence[oracle] ?? []), ...paths])];
    }
  }
  return {
    scenarioId: first.scenarioId,
    environment: first.environment,
    status,
    startedAt: results.map((result) => result.startedAt).sort()[0]!,
    finishedAt: results.map((result) => result.finishedAt).sort().at(-1)!,
    runner: first.runner,
    evidence,
    fixtures: results.flatMap((result) => result.fixtures),
  };
}

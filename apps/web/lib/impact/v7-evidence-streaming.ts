import {
  beginEngineeringAggregationV7, evidenceSourceKey, type EngineeringAggregation,
  type EngineeringEvidenceInput, type NormalizedEngineeringEvent,
} from "@chapa/shared";
import { deriveCoreEvidenceV7, type CoreEvidenceV7 } from "./v7-evidence";

function acceptedKind(event: NormalizedEngineeringEvent): boolean {
  if (event.acceptance.status !== "observed") return false;
  const method = event.acceptance.value.method;
  return (event.kind === "accepted_change" && (method === "merged_change" || method === "linked_issue_result")) ||
    (event.kind === "authored_commit" && method === "default_branch_first_reachability") ||
    (event.kind === "issue_work" && method === "linked_issue_result") ||
    ((event.kind === "documentation_design" || event.kind === "maintenance") && method === "accepted_artifact");
}

/** Scoring output without retained source arrays. Every known selected work
 * has a support entry, even if it has no artifact references. */
export interface StreamingObservedEvidence extends Omit<CoreEvidenceV7, "aggregation"> {
  readonly scope: EngineeringAggregation["scope"];
  readonly assessments: EngineeringAggregation["assessments"];
  readonly acceptedWork: EngineeringAggregation["acceptedWork"];
  readonly acceptanceSelections: EngineeringAggregation["acceptanceSelections"];
  readonly diagnostics: EngineeringAggregation["diagnostics"];
  readonly selectedWorkSupport: ReadonlyMap<string, ReadonlySet<string>>;
}

export function beginObservedEvidence(meta: Omit<EngineeringEvidenceInput, "events">) {
  const reducer = beginEngineeringAggregationV7(meta);
  return {
    addSortedPage(page: readonly NormalizedEngineeringEvent[]): void { reducer.addSortedPage(page); },
    finish(): StreamingObservedEvidence {
      const scored = deriveCoreEvidenceV7(reducer.finish());
      const aggregation = scored.aggregation;
      const unresolved = new Set(aggregation.scope.sources
        .filter(source => source.reasonCodes.includes("alias_unresolved"))
        .map(source => evidenceSourceKey(source.source)));
      const selections = new Map(aggregation.acceptanceSelections.map(selection => [selection.workItemId, selection.acceptedEventId]));
      const selectedWorkSupport = new Map<string, Set<string>>();
      for (const event of aggregation.events) {
        const selection = selections.get(event.workItemId);
        if (selection && selection !== event.eventId && (event.kind === "accepted_change" || acceptedKind(event))) continue;
        if (unresolved.has(evidenceSourceKey(event))) continue;
        const references = selectedWorkSupport.get(event.workItemId) ?? new Set<string>();
        for (const reference of event.artifactReferenceIds) references.add(reference);
        selectedWorkSupport.set(event.workItemId, references);
      }
      return {
        inputs: scored.inputs, observedCounts: scored.observedCounts,
        activityCalendar: scored.activityCalendar, limitations: scored.limitations,
        scope: aggregation.scope, assessments: aggregation.assessments,
        acceptedWork: aggregation.acceptedWork, acceptanceSelections: aggregation.acceptanceSelections,
        diagnostics: aggregation.diagnostics, selectedWorkSupport,
      };
    },
  };
}

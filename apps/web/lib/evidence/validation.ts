import { isIP } from "node:net";
import { z } from "zod";
import { scoringInstant } from "@chapa/shared";

export const MAX_EVIDENCE_BYTES = 256 * 1024;
export const OUTCOME_CATEGORIES = ["delivered_benefit", "correctness_security", "performance_accessibility", "reliability_cost", "design_documentation", "mentoring_review", "maintenance_incident_recovery"] as const;
export const LEDGER_CRITERIA = ["rationale", "verification", "review_or_correction", "outcome_followup", "framing", "verification_debugging", "tool_judgment", "accepted_outcome"] as const;
const text = z.string().trim().min(1).max(4096);
const identifier = z.string().trim().min(1).max(512);
const handle = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/);
const instant = z.string().refine(value => { try { scoringInstant(value); return true; } catch { return false; } });
const period = z.strictObject({ startInclusive: instant, endExclusive: instant });
const strings = z.array(text).max(32);

/** Locators are stored, never fetched by this API. Reject dangerous schemes/origins as defense in depth. */
export function validateArtifactLocator(value: string): string {
  if (value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) throw new RangeError("Invalid artifact locator");
  if (/^urn:chapa:artifact:[0-9a-f-]{36}$/i.test(value)) return value;
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      isIP(host) || !host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test")) throw new RangeError("Unsafe artifact locator");
  return url.toString();
}
const reference = z.strictObject({ artifactUri: z.string().transform(validateArtifactLocator), artifactRevision: identifier, observedAt: instant, body: z.string().max(65536).optional() });
const identity = z.strictObject({ projectKey: identifier, workKey: identifier, referenceIds: z.array(identifier).min(1).max(32),
  repository: z.strictObject({ provider: z.enum(["github", "gitlab", "bitbucket", "codeberg"]), host: identifier, subjectId: identifier, repositoryId: identifier }).nullable().default(null),
  equivalentWork: z.strictObject({ canonicalWorkItemId: identifier, acceptedEventId: identifier }).nullable().default(null),
});
const facts = z.strictObject({
  identity, occurredAt: instant,
  kind: z.enum(["accepted_change", "authored_commit", "review", "issue_work", "documentation_design", "maintenance", "practice_evidence"]),
  attribution: z.enum(["individual", "team_participation", "unclear"]),
  categories: z.array(z.strictObject({ category: z.enum(["implementation", "verification_review", "documentation_design", "maintenance_support"]), referenceIds: z.array(identifier).min(1).max(32) })).max(4),
  acceptance: z.strictObject({ method: z.enum(["merged_change", "default_branch_first_reachability", "linked_issue_result", "accepted_artifact"]), acceptedAt: instant, acceptedResultId: identifier, referenceIds: z.array(identifier).min(1).max(32) }).nullable(),
});
const claimCommand = z.strictObject({
  action: z.literal("claim"), owner: handle, channel: z.enum(["core", "craft"]), previousRevisionId: z.uuid().nullable(),
  category: z.enum(OUTCOME_CATEGORIES), artifactRevision: identifier, occurredAt: instant,
  claim: text, baseline: z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("measured"), value: text }), z.strictObject({ kind: z.literal("not_available"), explanation: text })]),
  observedResult: text, method: text, contributorRole: text, attribution: z.enum(["individual", "team_participation", "unclear"]),
  observationPeriod: period, references: z.array(reference).min(1).max(32), limitations: strings, counterevidence: strings,
});
const assessmentCommand = z.strictObject({
  action: z.literal("assessment"), owner: handle, previousRevisionId: z.uuid().nullable(), claimRevisionId: z.uuid(),
  criterion: z.enum(LEDGER_CRITERIA), status: z.enum(["accepted", "rejected", "unassessed", "retracted"]), rubricVersion: z.literal("v7"), rationale: text,
  evaluatorType: z.enum(["human", "model"]), evaluatorVersion: identifier, independentlyCorroborated: z.boolean(), conflicts: strings,
  referenceIds: z.array(identifier).min(1).max(32), facts: facts.nullable(),
});
const command = z.discriminatedUnion("action", [claimCommand, assessmentCommand,
  z.strictObject({ action: z.literal("grant"), owner: handle, reviewer: handle, enabled: z.boolean() }),
  z.strictObject({ action: z.literal("retract"), owner: handle, revisionId: z.uuid(), rationale: text }),
  // `withdraw` is a retired action (publication is not opt-in, so there is
  // nothing left to withdraw) — kept recognizable here only so the route can
  // answer with a specific `retired_action` rather than a generic parse
  // failure. `consent` is gone entirely: no caller can construct one anymore.
  z.strictObject({ action: z.literal("withdraw"), owner: handle }),
]);
export type LedgerCommand = z.infer<typeof command>;
export type ClaimCommand = z.infer<typeof claimCommand>;
export type AssessmentCommand = z.infer<typeof assessmentCommand>;
export type VerifiedLedgerFacts = z.infer<typeof facts>;

export function parseLedgerCommand(value: unknown, referenceTime: string): LedgerCommand {
  const parsed = command.parse(value);
  const now = scoringInstant(referenceTime).getTime();
  const notFuture = (value: string) => { if (scoringInstant(value).getTime() > now) throw new RangeError("Future evidence time"); };
  if (parsed.action === "claim") {
    notFuture(parsed.occurredAt); notFuture(parsed.observationPeriod.endExclusive);
    if (scoringInstant(parsed.observationPeriod.startInclusive) >= scoringInstant(parsed.observationPeriod.endExclusive)) throw new RangeError("Invalid observation horizon");
    for (const ref of parsed.references) { notFuture(ref.observedAt); if (ref.body !== undefined && new TextEncoder().encode(ref.body).length > 65536) throw new RangeError("Artifact body too large"); }
  }
  if (parsed.action === "assessment") {
    if (parsed.independentlyCorroborated && (parsed.evaluatorType !== "human" || parsed.conflicts.length)) throw new RangeError("Conflicted or automated assessment cannot be independent corroboration");
    if (parsed.facts) {
      notFuture(parsed.facts.occurredAt);
      if (parsed.facts.acceptance) {
        notFuture(parsed.facts.acceptance.acceptedAt);
        const allowed = { accepted_change: ["merged_change", "linked_issue_result"], authored_commit: ["default_branch_first_reachability"], issue_work: ["linked_issue_result"], documentation_design: ["accepted_artifact"], maintenance: ["accepted_artifact"], review: [], practice_evidence: [] };
        if (!(allowed[parsed.facts.kind] as string[]).includes(parsed.facts.acceptance.method)) throw new RangeError("Acceptance method does not match the reviewed event");
      }
    }
  }
  return parsed;
}

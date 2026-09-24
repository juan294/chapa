export interface RedesignUpstreamFixtures {
  qualificationHealth?: boolean;
  journeyRunId?: 'redesign';
  avatarPng?: string;
  contributionQuery?: string;
  repositoryQuery?: string;
  /** #1335 phase 4.8 — the real v7.2 collection engine's GraphQL responses,
   * keyed by exact query text (see scoring-point-fixtures.ts's
   * githubZeroActivityResponses). */
  githubCollectionResponses?: Record<string, unknown>;
  cache: Record<string, unknown>;
  github: Record<string, unknown>;
}
export function createRedesignFetch(
  fixtures: RedesignUpstreamFixtures,
  localFetch?: typeof fetch,
  onUnexpected?: (message: string) => void,
): typeof fetch;

export interface RedesignUpstreamFixtures {
  qualificationHealth?: boolean;
  journeyRunId?: 'redesign';
  avatarPng?: string;
  contributionQuery?: string;
  cache: Record<string, unknown>;
  github: Record<string, unknown>;
}
export function createRedesignFetch(
  fixtures: RedesignUpstreamFixtures,
  localFetch?: typeof fetch,
  onUnexpected?: (message: string) => void,
): typeof fetch;

const sharedScenarioIds = [
  "health.core-dependencies",
  "profile.public-badge-read",
  "profile.public-share-read",
] as const;

const previewOnlyScenarioIds = [
  "auth.github-login-redirect",
  "auth.protected-write-denied",
] as const;

export function releaseRequiredScenarioIds(
  environment: string | undefined,
): ReadonlySet<string> {
  return new Set([
    environment === "production"
      ? "deployment.production-identity"
      : "deployment.preview-identity",
    ...sharedScenarioIds,
    ...(environment === "production" ? [] : previewOnlyScenarioIds),
  ]);
}

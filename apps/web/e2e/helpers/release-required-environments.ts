export type DeploymentEnvironment = "preview" | "production";
export type ReleaseVerificationMode = "default" | "deep";

const deploymentEnvironments: readonly DeploymentEnvironment[] = [
  "preview",
  "production",
];
const releaseVerificationModes: readonly ReleaseVerificationMode[] = [
  "default",
  "deep",
];

function isDeploymentEnvironment(
  value: string | undefined,
): value is DeploymentEnvironment {
  return deploymentEnvironments.includes(value as DeploymentEnvironment);
}

function isReleaseVerificationMode(
  value: string | undefined,
): value is ReleaseVerificationMode {
  return releaseVerificationModes.includes(value as ReleaseVerificationMode);
}

export function parseReleaseVerificationMode(
  raw: string | undefined,
): ReleaseVerificationMode {
  if (raw === undefined) return "default";
  if (isReleaseVerificationMode(raw)) return raw;
  throw new Error(
    `unknown release verification mode: ${raw}. Expected "default" or "deep".`,
  );
}

const corePublicReadScenarioIds = [
  "health.core-dependencies",
  "profile.public-badge-read",
  "profile.public-share-read",
] as const;

const deepSharedScenarioIds = ["profile.share-verification", "locales.en-es"] as const;

const previewDeepScenarioIds = [
  "auth.github-login-redirect",
  "auth.protected-write-denied",
] as const;

function identityScenarioId(environment: DeploymentEnvironment): string {
  return environment === "production"
    ? "deployment.production-identity"
    : "deployment.preview-identity";
}

export function releaseRequiredScenarioIds(
  environment: string | undefined,
  mode: string | undefined = "default",
): ReadonlySet<string> {
  if (!isDeploymentEnvironment(environment)) {
    throw new Error(
      `unknown deployment environment: ${environment}. Expected "preview" or "production".`,
    );
  }
  const parsedMode = parseReleaseVerificationMode(mode);

  const selected: string[] = [
    identityScenarioId(environment),
    ...corePublicReadScenarioIds,
  ];

  if (environment === "preview") {
    selected.push("rollback.readiness");
  }

  if (parsedMode === "deep") {
    selected.push(...deepSharedScenarioIds);
    if (environment === "preview") {
      selected.push(...previewDeepScenarioIds);
    }
  }

  return new Set(selected);
}

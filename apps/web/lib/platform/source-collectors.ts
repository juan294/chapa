import "server-only";
import { fetchGitHubEvidence } from "@/lib/github/evidence";
import { fetchGitlabEvidence } from "@/lib/gitlab/evidence";
import { fetchCodebergEvidence } from "@/lib/codeberg/evidence";
import { fetchBitbucketEvidence } from "@/lib/bitbucket/evidence";
import { appendSourceObservation, discoverStoredSource, readSourceObservation } from "@/lib/db/source-context";
import { createSourceCoordinator, type SourceCollectorResult } from "./source-coordinator";
import type { SourceContextInput } from "./source-context";
import { readSourceAuthorization } from "./source-authorization";
import { refreshSourceLink } from "./source-refresh";

export async function collectSource(input: SourceContextInput, token: string | undefined): Promise<SourceCollectorResult | null> {
  const { provider, login } = input.requestedSource;
  const explicit = input.scope.discovery === "explicit_repositories";
  if (!explicit && input.scope.discovery !== "owned_and_contributed") return null;
  if (provider === "github") return fetchGitHubEvidence(login, input.window, undefined,
    { resolvedCredential: { token: token ?? null }, ...(explicit ? { repositoryIds: input.scope.repositoryIds } : {}) });
  if (!token) return null;
  // Canonical identity must come from the same credential, never the login.
  const urls = { gitlab: "https://gitlab.com/api/v4/user", codeberg: "https://codeberg.org/api/v1/user", bitbucket: "https://api.bitbucket.org/2.0/user" };
  const response = await fetch(urls[provider], { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000), redirect: "error" });
  if (!response.ok) return null;
  const user = await response.json() as Record<string, unknown>;
  if (provider === "bitbucket") {
    if (typeof user.account_id !== "string" || !user.account_id.trim()) return null;
    return fetchBitbucketEvidence(user.account_id, token, input.window,
      explicit ? { repositoryIds: input.scope.repositoryIds } : {});
  }
  if (typeof user.id !== "number" || !Number.isSafeInteger(user.id) || user.id <= 0 || (provider === "gitlab" ? user.username : user.login) !== login) return null;
  const ids = input.scope.repositoryIds.map(Number);
  if (explicit && ids.some((id, i) => !Number.isSafeInteger(id) || id <= 0 || String(id) !== input.scope.repositoryIds[i])) return null;
  const options = explicit ? { repositoryIds: ids } : {};
  return provider === "gitlab" ? fetchGitlabEvidence(user.id, login, token, input.window, options) : fetchCodebergEvidence(user.id, login, token, input.window, options);
}

/** Live v7 entry point; legacy scalar consumers remain a separate boundary. */
export const selectSourceEvidence = createSourceCoordinator({ authorize: readSourceAuthorization,
  discover: discoverStoredSource, read: readSourceObservation, append: appendSourceObservation,
  refreshLink: refreshSourceLink, collect: collectSource });

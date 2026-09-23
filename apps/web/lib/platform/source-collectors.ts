import "server-only";
import { fetchGitHubEvidence } from "@/lib/github/evidence";
import { fetchGitlabEvidence } from "@/lib/gitlab/evidence";
import { fetchCodebergEvidence } from "@/lib/codeberg/evidence";
import { fetchBitbucketEvidence } from "@/lib/bitbucket/evidence";
import { appendSourceObservation, discoverStoredSource, readSourceObservation } from "@/lib/db/source-context";
import {
  classifyFetchFailure, isRateLimitedResponse, retryAfterSeconds, type SourceDiagnostic,
} from "@/lib/platform/evidence-diagnostics";
import { createSourceCoordinator, type SourceCollectorResult } from "./source-coordinator";
import type { SourceContextInput } from "./source-context";
import { readSourceAuthorization } from "./source-authorization";
import { refreshSourceLink } from "./source-refresh";

export interface SourceCollectionOutcome {
  readonly result: SourceCollectorResult | null;
  readonly diagnostics: readonly SourceDiagnostic[];
}
const clean = (result: SourceCollectorResult | null): SourceCollectionOutcome => ({ result, diagnostics: [] });

export async function collectSource(input: SourceContextInput, token: string | undefined): Promise<SourceCollectionOutcome> {
  const { provider, login } = input.requestedSource;
  const explicit = input.scope.discovery === "explicit_repositories";
  if (!explicit && input.scope.discovery !== "owned_and_contributed") return clean(null);
  if (provider === "github") {
    const evidence = await fetchGitHubEvidence(login, input.window, undefined,
      { resolvedCredential: { token: token ?? null }, ...(explicit ? { repositoryIds: input.scope.repositoryIds } : {}) });
    return { result: evidence, diagnostics: evidence?.diagnostics ?? [] };
  }
  if (!token) return clean(null);
  // Canonical identity must come from the same credential, never the login.
  const urls = { gitlab: "https://gitlab.com/api/v4/user", codeberg: "https://codeberg.org/api/v1/user", bitbucket: "https://api.bitbucket.org/2.0/user" };
  const signal = AbortSignal.timeout(8_000);
  let response: Response;
  try {
    response = await fetch(urls[provider], { headers: { Authorization: `Bearer ${token}` }, signal, redirect: "error" });
  } catch (error) {
    return { result: null, diagnostics: [{ provider, operation: "preflight_user", stopKind: classifyFetchFailure(error, signal), httpStatus: null, retryAfterSeconds: null }] };
  }
  if (!response.ok) {
    const stopKind = isRateLimitedResponse(response.status, response.headers)
      ? "rate_limited" as const
      : response.status === 401 || response.status === 403 ? "not_accessible" as const : "http" as const;
    return { result: null, diagnostics: [{ provider, operation: "preflight_user", stopKind, httpStatus: response.status, retryAfterSeconds: retryAfterSeconds(response.headers) }] };
  }
  const user = await response.json() as Record<string, unknown>;
  if (provider === "bitbucket") {
    if (typeof user.account_id !== "string" || !user.account_id.trim()) return clean(null);
    const evidence = await fetchBitbucketEvidence(user.account_id, token, input.window,
      explicit ? { repositoryIds: input.scope.repositoryIds } : {});
    return { result: evidence, diagnostics: evidence.diagnostics };
  }
  if (typeof user.id !== "number" || !Number.isSafeInteger(user.id) || user.id <= 0 || (provider === "gitlab" ? user.username : user.login) !== login) return clean(null);
  const ids = input.scope.repositoryIds.map(Number);
  if (explicit && ids.some((id, i) => !Number.isSafeInteger(id) || id <= 0 || String(id) !== input.scope.repositoryIds[i])) return clean(null);
  const options = explicit ? { repositoryIds: ids } : {};
  const evidence = provider === "gitlab" ? await fetchGitlabEvidence(user.id, login, token, input.window, options) : await fetchCodebergEvidence(user.id, login, token, input.window, options);
  return { result: evidence, diagnostics: evidence.diagnostics };
}

/** Live v7 entry point; legacy scalar consumers remain a separate boundary. */
export const selectSourceEvidence = createSourceCoordinator({ authorize: readSourceAuthorization,
  discover: discoverStoredSource, read: readSourceObservation, append: appendSourceObservation,
  refreshLink: refreshSourceLink, collect: collectSource });

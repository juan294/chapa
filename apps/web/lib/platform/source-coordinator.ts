import "server-only";
import { randomUUID } from "node:crypto";
import { canonicalJson, createScoringWindow, type NormalizedEngineeringEvent, type SourceCoverage } from "@chapa/shared";
import { appendSourceObservation, discoverStoredSource, readSourceObservation, type SourceStorageContext, type StoredSourceObservation } from "@/lib/db/source-context";
import { emitSourceDiagnostics, type SourceDiagnostic } from "@/lib/platform/evidence-diagnostics";
import { createSourceContext, type SourceContextInput } from "./source-context";
import { readSourceAuthorization, sameSourceAuthorization, type SourceAuthorization, type SourceProvider } from "./source-authorization";

/** Private server result: normalized repository/file evidence is never a public
 * receipt or API payload. S15 must project only consented public aggregates.
 */
export type SourceSelection =
  | { status: "observed" | "stale"; observation: StoredSourceObservation }
  | { status: "unavailable" | "unsupported" | "disabled" | "unlinked" | "readonlymiss" };
export interface SourceCoordinatorInput {
  readonly owner: string;
  readonly provider: SourceProvider;
  readonly window: SourceContextInput["window"];
  readonly scope: SourceContextInput["scope"];
  readonly token?: string;
  readonly readOnly?: boolean;
  readonly refresh?: boolean;
}
export interface SourceCollectorResult { readonly coverage: SourceCoverage; readonly events: readonly NormalizedEngineeringEvent[] }
export interface SourceCollectionOutcome {
  readonly result: SourceCollectorResult | null;
  readonly diagnostics: readonly SourceDiagnostic[];
}
export interface SourceCoordinatorDependencies {
  authorize: typeof readSourceAuthorization;
  discover: typeof discoverStoredSource;
  read: typeof readSourceObservation;
  append: typeof appendSourceObservation;
  collect: (input: SourceContextInput, token: string | undefined) => Promise<SourceCollectionOutcome>;
  refreshLink: (authorization: Extract<SourceAuthorization, { status: "authorized" }>, input: SourceCoordinatorInput) => Promise<SourceAuthorization>;
}
const hosts: Record<SourceProvider, string> = { github: "github.com", gitlab: "gitlab.com", bitbucket: "bitbucket.org", codeberg: "codeberg.org" };
const detach = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;

/** Each factory owns a private map. Results and request context are detached at
 * both boundaries; callers never receive shared mutable evidence or access IDs.
 */
export function createSourceCoordinator(deps: SourceCoordinatorDependencies) {
  const inflight = new Map<string, Promise<SourceSelection>>();
  return async function selectSource(input: SourceCoordinatorInput): Promise<SourceSelection> {
    try {
      // Preserve an explicitly supplied empty token; omit undefined JSON keys.
      const request: SourceCoordinatorInput = detach({ owner: input.owner.toLowerCase(), provider: input.provider,
        window: input.window, scope: input.provider === "bitbucket"
          ? { ...input.scope, repositoryIds: input.scope.repositoryIds.map(id => id.toLowerCase()) }
          : input.scope, readOnly: input.readOnly === true, refresh: input.refresh === true,
        ...(input.token !== undefined ? { token: input.token } : {}) });
      if (canonicalJson(request.window) !== canonicalJson(createScoringWindow(request.window.referenceTime))) return { status: "unavailable" };
      if (!["owned_and_contributed", "explicit_repositories"].includes(request.scope.discovery)) return { status: "unsupported" };
      let authorization = await deps.authorize(request.owner, request.provider);
      if (authorization.status !== "authorized") return authorization;
      if (!request.readOnly && authorization.link) {
        authorization = await deps.refreshLink(authorization, request);
        if (authorization.status !== "authorized") return authorization;
      }
      const initial = authorization;
      const bindingInput: SourceContextInput = detach({ owner: request.owner,
        requestedSource: { provider: request.provider, host: hosts[request.provider], login: request.provider === "github" ? request.owner : initial.link!.remoteLogin },
        window: request.window, scope: request.scope });
      const binding = initial.link
        ? createSourceContext(bindingInput, { kind: "linked", link: initial.link, accessToken: initial.link.tokens.accessToken.trim() })
        : createSourceContext(bindingInput, { kind: "github", ...(request.token !== undefined ? { token: request.token } : {}) });
      const current = async () => sameSourceAuthorization(initial, await deps.authorize(request.owner, request.provider));
      if (!await current()) return { status: "unavailable" };
      const context = { ...bindingInput, accessContextId: binding.accessContextId,
        link: initial.link ? { id: initial.link.id, updatedAt: initial.link.updatedAt } : null };
      const run = async (): Promise<SourceSelection> => {
        const identity = await deps.discover(context);
        if (!await current() || identity.status === "ambiguous") return { status: "unavailable" };
        let prior: StoredSourceObservation | null = null;
        if (identity.status === "found") {
          const storedContext: SourceStorageContext = { ...context, source: identity.source };
          const exact = await deps.read(storedContext);
          if (!await current()) return { status: "unavailable" };
          if (exact && (!request.refresh || request.readOnly)) return { status: "observed", observation: exact };
          prior = exact ?? await deps.read(storedContext, true);
          if (!await current()) return { status: "unavailable" };
        }
        if (request.readOnly) return prior ? { status: "stale", observation: prior } : { status: "readonlymiss" };
        const outcome = await binding.collect(token => deps.collect(detach(bindingInput), token))
          .catch((): SourceCollectionOutcome => ({ result: null, diagnostics: [] }));
        // Emitted for every attempt, including a clean run (where it is a
        // no-op) -- diagnostics never wait on the current-authorization check
        // below, since the collection itself already happened.
        emitSourceDiagnostics(request.owner, outcome.diagnostics);
        const collected = outcome.result;
        if (!await current()) return { status: "unavailable" };
        if (!collected) return prior ? { status: "stale", observation: prior } : { status: "unavailable" };
        // Never carry checkpoint URLs, raw bodies or profile objects to storage.
        const value = { id: randomUUID(), window: request.window, coverage: collected.coverage, events: collected.events };
        const observation = await deps.append({ ...context, source: collected.coverage.source }, value);
        if (!await current()) return { status: "unavailable" };
        // A same-reference partial refresh cannot displace the complete issued
        // observation. The partial observation is retained with its own status.
        if (prior?.coverage.status === "complete" && canonicalJson(prior.window) === canonicalJson(request.window) && observation.coverage.status !== "complete") return { status: "observed", observation: prior };
        return { status: "observed", observation };
      };
      // Read-only must never join work which can refresh, collect or append.
      const key = `${binding.selectionId}:${initial.subjectVersion}:${request.readOnly ? "read" : "write"}:${request.refresh ? "refresh" : "cached"}`;
      let work = inflight.get(key);
      if (!work) {
        work = run(); inflight.set(key, work);
        void work.finally(() => { if (inflight.get(key) === work) inflight.delete(key); }).catch(() => undefined);
      }
      const selected = await work;
      return await current() ? detach(selected) : { status: "unavailable" };
    } catch { return { status: "unavailable" }; }
  };
}

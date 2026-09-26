import "server-only";
import { canonicalJson, createScoringWindow } from "@chapa/shared";
import { discoverStoredSource, readSourceManifest, readSourceObservation, readSourcePages,
  type SourceObservationManifest, type SourceStorageContext, type StoredSourceObservation } from "@/lib/db/source-context";
import type { NormalizedEngineeringEvent } from "@chapa/shared";
import type { EnqueueReason } from "@/lib/db/collection-queue";
import { createSourceContext, type SourceContextInput } from "./source-context";
import { readSourceAuthorization, type SourceAuthorization, type SourceProvider } from "./source-authorization";

/**
 * Read-only since #1335 phase 3: this module no longer discovers a live
 * credential to collect with, fetches provider data, or appends a source
 * observation. Collection happens exclusively in the durable queue worker
 * (`lib/collection/worker.ts`), which resolves its own credential and calls
 * the existing append path directly. This coordinator's only job is to serve
 * whatever has already been durably observed, and -- for `refresh: true` --
 * to enqueue a job for the worker to pick up rather than collecting inline.
 *
 * Private server result: normalized repository/file evidence is never a public
 * receipt or API payload. S15 must project only consented public aggregates.
 */
export type SourceSelection =
  | { status: "observed" | "stale"; observation: StoredSourceObservation; inProgress: boolean }
  | { status: "unavailable" | "unsupported" | "disabled" | "unlinked" | "readonlymiss" };
export interface SourceCoordinatorInput {
  readonly owner: string;
  readonly provider: SourceProvider;
  readonly window: SourceContextInput["window"];
  readonly scope: SourceContextInput["scope"];
  /** Retained for call-site compatibility; a read-only coordinator never
   * fetches, so no token of its own is ever needed here. */
  readonly token?: string;
  readonly readOnly?: boolean;
  /** Enqueues a fresh collection job instead of collecting inline. */
  readonly refresh?: boolean;
}
export interface SourceCoordinatorDependencies {
  authorize: typeof readSourceAuthorization;
  discover: typeof discoverStoredSource;
  read: typeof readSourceObservation;
  /** Enqueues a `refresh` job; never collects or appends inline. Failure to
   * enqueue degrades to an ordinary read rather than failing the request --
   * an owner still sees their last observation instead of an error. */
  enqueue: (owner: string, provider: SourceProvider, reason: EnqueueReason, referenceTime: string) => Promise<unknown>;
  jobInProgress: (owner: string, provider: SourceProvider, referenceDate: string) => Promise<boolean>;
}
export interface SourceManifestCoordinatorDependencies extends Omit<SourceCoordinatorDependencies, "read"> {
  readManifest: typeof readSourceManifest;
  readPages: typeof readSourcePages;
}
export type SourceManifestSelection =
  | { status: "observed" | "stale"; manifest: SourceObservationManifest; pages: () => AsyncIterable<readonly NormalizedEngineeringEvent[]>;
      assertCurrent: () => Promise<void>; inProgress: boolean }
  | { status: "unavailable" | "unsupported" | "disabled" | "unlinked" | "readonlymiss" };
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
      const authorization: SourceAuthorization = await deps.authorize(request.owner, request.provider);
      if (authorization.status !== "authorized") return authorization;
      const initial = authorization;
      const bindingInput: SourceContextInput = detach({ owner: request.owner,
        requestedSource: { provider: request.provider, host: hosts[request.provider], login: request.provider === "github" ? request.owner : initial.link!.remoteLogin },
        window: request.window, scope: request.scope });
      // No refresh here: a possibly-stale bound token still identifies which
      // access context to read observations under. The worker refreshes for
      // real before it collects and appends under the token it actually used.
      const binding = initial.link
        ? createSourceContext(bindingInput, { kind: "linked", link: initial.link, accessToken: initial.link.tokens.accessToken.trim() })
        : createSourceContext(bindingInput, { kind: "github", ...(request.token !== undefined ? { token: request.token } : {}) });
      const current = async () => {
        const latest = await deps.authorize(request.owner, request.provider);
        return latest.status === "authorized" && latest.subjectVersion === initial.subjectVersion && latest.link?.id === initial.link?.id &&
          latest.link?.updatedAt === initial.link?.updatedAt && latest.link?.remoteLogin === initial.link?.remoteLogin &&
          latest.link?.tokens.accessToken === initial.link?.tokens.accessToken;
      };
      const context = { ...bindingInput, accessContextId: binding.accessContextId,
        link: initial.link ? { id: initial.link.id, updatedAt: initial.link.updatedAt } : null };
      const run = async (): Promise<SourceSelection> => {
        const identity = await deps.discover(context);
        if (!await current() || identity.status === "ambiguous") return { status: "unavailable" };
        let prior: StoredSourceObservation | null = null;
        let exact: StoredSourceObservation | null = null;
        if (identity.status === "found") {
          const storedContext: SourceStorageContext = { ...context, source: identity.source };
          exact = await deps.read(storedContext);
          if (!await current()) return { status: "unavailable" };
          prior = exact ?? await deps.read(storedContext, true);
          if (!await current()) return { status: "unavailable" };
        }
        if (request.refresh && !request.readOnly) {
          // Best-effort: a failed enqueue still leaves the read below intact.
          await deps.enqueue(request.owner, request.provider, "refresh", request.window.referenceTime).catch(() => undefined);
        }
        const inProgress = await deps.jobInProgress(request.owner, request.provider, request.window.referenceDate).catch(() => false);
        if (exact) return { status: "observed", observation: exact, inProgress };
        if (prior) return { status: "stale", observation: prior, inProgress };
        return request.readOnly ? { status: "readonlymiss" } : { status: "unavailable" };
      };
      // Read-only must never join work which can enqueue.
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

/** Selects immutable metadata without materializing source events. The page
 * capability closes over the private storage context and verifies current
 * authorization before every yielded page and after the final integrity check.
 */
export function createSourceManifestCoordinator(deps: SourceManifestCoordinatorDependencies) {
  type MetadataSelection =
    | { status: "observed" | "stale"; manifest: SourceObservationManifest; inProgress: boolean }
    | { status: "unavailable" | "unsupported" | "disabled" | "unlinked" | "readonlymiss" };
  const inflight = new Map<string, Promise<MetadataSelection>>();
  return async function selectSourceManifest(input: SourceCoordinatorInput): Promise<SourceManifestSelection> {
    try {
      const request: SourceCoordinatorInput = detach({ owner: input.owner.toLowerCase(), provider: input.provider,
        window: input.window, scope: input.provider === "bitbucket"
          ? { ...input.scope, repositoryIds: input.scope.repositoryIds.map(id => id.toLowerCase()) }
          : input.scope, readOnly: input.readOnly === true, refresh: input.refresh === true,
        ...(input.token !== undefined ? { token: input.token } : {}) });
      if (canonicalJson(request.window) !== canonicalJson(createScoringWindow(request.window.referenceTime))) return { status: "unavailable" };
      if (!["owned_and_contributed", "explicit_repositories"].includes(request.scope.discovery)) return { status: "unsupported" };
      const authorization: SourceAuthorization = await deps.authorize(request.owner, request.provider);
      if (authorization.status !== "authorized") return authorization;
      const initial = authorization;
      const bindingInput: SourceContextInput = detach({ owner: request.owner,
        requestedSource: { provider: request.provider, host: hosts[request.provider], login: request.provider === "github" ? request.owner : initial.link!.remoteLogin },
        window: request.window, scope: request.scope });
      const binding = initial.link
        ? createSourceContext(bindingInput, { kind: "linked", link: initial.link, accessToken: initial.link.tokens.accessToken.trim() })
        : createSourceContext(bindingInput, { kind: "github", ...(request.token !== undefined ? { token: request.token } : {}) });
      const current = async () => {
        const latest = await deps.authorize(request.owner, request.provider);
        return latest.status === "authorized" && latest.subjectVersion === initial.subjectVersion && latest.link?.id === initial.link?.id &&
          latest.link?.updatedAt === initial.link?.updatedAt && latest.link?.remoteLogin === initial.link?.remoteLogin &&
          latest.link?.tokens.accessToken === initial.link?.tokens.accessToken;
      };
      const context = { ...bindingInput, accessContextId: binding.accessContextId,
        link: initial.link ? { id: initial.link.id, updatedAt: initial.link.updatedAt } : null };
      const run = async (): Promise<MetadataSelection> => {
        const identity = await deps.discover(context);
        if (!await current() || identity.status === "ambiguous") return { status: "unavailable" };
        let exact: SourceObservationManifest | null = null;
        let prior: SourceObservationManifest | null = null;
        if (identity.status === "found") {
          const storedContext: SourceStorageContext = { ...context, source: identity.source };
          exact = await deps.readManifest(storedContext);
          if (!await current()) return { status: "unavailable" };
          prior = exact ?? await deps.readManifest(storedContext, true);
          if (!await current()) return { status: "unavailable" };
        }
        if (request.refresh && !request.readOnly) {
          await deps.enqueue(request.owner, request.provider, "refresh", request.window.referenceTime).catch(() => undefined);
        }
        const inProgress = await deps.jobInProgress(request.owner, request.provider, request.window.referenceDate).catch(() => false);
        if (exact) return { status: "observed", manifest: exact, inProgress };
        if (prior) return { status: "stale", manifest: prior, inProgress };
        return request.readOnly ? { status: "readonlymiss" } : { status: "unavailable" };
      };
      const key = `${binding.selectionId}:${initial.subjectVersion}:${request.readOnly ? "read" : "write"}:${request.refresh ? "refresh" : "cached"}`;
      let work = inflight.get(key);
      if (!work) {
        work = run(); inflight.set(key, work);
        void work.finally(() => { if (inflight.get(key) === work) inflight.delete(key); }).catch(() => undefined);
      }
      const selected = await work;
      if (!await current()) return { status: "unavailable" };
      if (!("manifest" in selected)) return selected;
      const manifest = detach(selected.manifest);
      const source = manifest.coverage.source;
      const storedContext: SourceStorageContext = { ...context, source };
      const assertCurrent = async () => { if (!await current()) throw new Error("Source authorization changed"); };
      return { status: selected.status, manifest: detach(manifest), inProgress: selected.inProgress,
        assertCurrent,
        pages: async function* () {
          await assertCurrent();
          for await (const page of deps.readPages(storedContext, manifest)) {
            await assertCurrent();
            yield page;
          }
          await assertCurrent();
        } };
    } catch { return { status: "unavailable" }; }
  };
}

import "server-only";
import { createHmac } from "node:crypto";
import { inspect } from "node:util";
import { canonicalJson, createScoringWindow } from "@chapa/shared";
import type { ScoringWindow, SourceCoverage } from "@chapa/shared";
import type { StrictLinkedPlatform } from "@/lib/db/user-platforms";
import { getGithubToken, getNextauthSecret } from "@/lib/env";

export interface SourceContextInput {
  readonly owner: string;
  readonly requestedSource: { readonly provider: "github" | "gitlab" | "bitbucket" | "codeberg"; readonly host: string; readonly login: string };
  readonly window: ScoringWindow;
  readonly scope: { readonly discovery: SourceCoverage["discovery"]; readonly repositoryIds: readonly string[]; readonly eventKinds: readonly string[] };
}
export type SourceCredential =
  | { kind: "github"; token?: string }
  | { kind: "linked"; link: StrictLinkedPlatform; accessToken: string };

/** Private server capability. Never serialize this or its access ID into a
 * receipt, API, log or shared Redis key. Credential equality is not proof of
 * unchanged remote permissions or complete private repository visibility.
 */
class PrivateSourceContext {
  #token: string | undefined;
  #id: string;
  #selectionId: string;
  constructor(token: string | undefined, id: string, selectionId: string) { this.#token = token; this.#id = id; this.#selectionId = selectionId; }
  get accessContextId(): string { return this.#id; }
  get selectionId(): string { return this.#selectionId; }
  collect<T>(collector: (effectiveToken: string | undefined) => Promise<T>): Promise<T> { return collector(this.#token); }
  toJSON(): Record<string, never> { return {}; }
  [inspect.custom](): string { return "[PrivateSourceContext]"; }
}

/** The collector callback receives exactly the credential included in this
 * binding. Refreshed linked tokens must be bound after refresh; no refresh or
 * authorization claim occurs here. The coordinator owns current-link rechecks.
 */
export function createSourceContext(input: SourceContextInput, credential: SourceCredential): PrivateSourceContext {
  try {
    const secret = getNextauthSecret();
    if (!secret || !input.owner.trim() || !input.requestedSource.host.trim() || !input.requestedSource.login.trim() ||
      canonicalJson(input.window) !== canonicalJson(createScoringWindow(input.window.referenceTime))) throw new Error();
    const owner = input.owner.toLowerCase();
    let token: string | undefined;
    let link: { id: string; updatedAt: string; remoteLogin: string } | null = null;
    if (credential.kind === "github") {
      if (input.requestedSource.provider !== "github") throw new Error();
      token = credential.token ?? getGithubToken();
    } else {
      if (credential.link.handle !== owner || credential.link.platform !== input.requestedSource.provider || credential.link.remoteLogin !== input.requestedSource.login || !credential.accessToken.trim()) throw new Error();
      token = credential.accessToken;
      link = { id: credential.link.id, updatedAt: credential.link.updatedAt, remoteLogin: credential.link.remoteLogin };
    }
    const bytes = canonicalJson({ version: "source-context-v1", owner, requestedSource: input.requestedSource, scope: input.scope, link, credential: token ?? null });
    const id = createHmac("sha256", secret).update(bytes, "utf8").digest("hex");
    const selectionId = createHmac("sha256", secret).update(canonicalJson({ version: "source-selection-v1", accessContextId: id, window: input.window }), "utf8").digest("hex");
    return new PrivateSourceContext(token, id, selectionId);
  } catch { throw new Error("Invalid source context"); }
}

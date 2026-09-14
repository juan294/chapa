import "server-only";
import { isTokenExpired } from "@/lib/auth/bitbucket";
import { readSourceAuthorization, type SourceProvider } from "./source-authorization";

/** GitHub is excluded: it is never a *linked* source, so it can never be the
 * connection a user has to go and repair. */
const LINKED_PROVIDERS = ["bitbucket", "codeberg", "gitlab"] as const;

/**
 * Which connected platforms cannot currently supply evidence.
 *
 * `getStats` refuses to score an aggregate that silently drops a connected
 * source (`lib/github/client.ts`), so one unusable link turns the whole fetch
 * into `null`. That is the right call — a score missing a platform the user
 * connected is a wrong score — but `null` carries no reason, and the caller
 * could only ever say "something went wrong". This answers the one question
 * the user can act on: which connection is broken.
 *
 * Read-only by construction. It reads authorization state and inspects token
 * expiry; it never attempts the refresh, so calling it on a failure path
 * cannot consume a refresh grant or race the attempt that just failed.
 */
export async function findUnusableSourceLinks(owner: string): Promise<SourceProvider[]> {
  const checked = await Promise.all(
    LINKED_PROVIDERS.map(async (provider): Promise<SourceProvider | null> => {
      const auth = await readSourceAuthorization(owner, provider, false);
      // "unlinked" and "disabled" are healthy states: nothing is connected, so
      // nothing is missing from the aggregate.
      if (auth.status === "unavailable") return provider;
      if (auth.status === "authorized" && auth.link && isTokenExpired(auth.link.tokens.expiresAt)) return provider;
      return null;
    }),
  );
  return checked.filter((provider): provider is SourceProvider => provider !== null);
}

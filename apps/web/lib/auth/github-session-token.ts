import { dbGetLinkedPlatform, dbUpsertLinkedPlatform } from "@/lib/db/user-platforms";

const GITHUB_PLATFORM = "github";

interface GitHubSessionLike {
  login: string;
  token?: string;
}

export async function getStoredGitHubToken(handle: string): Promise<string | null> {
  const linked = await dbGetLinkedPlatform(handle, GITHUB_PLATFORM);
  return linked?.tokens.accessToken ?? null;
}

export async function getSessionGitHubToken(
  session: GitHubSessionLike,
): Promise<string | null> {
  return session.token ?? getStoredGitHubToken(session.login);
}

export async function storeGitHubToken(
  handle: string,
  accessToken: string,
): Promise<boolean> {
  return dbUpsertLinkedPlatform(
    handle,
    GITHUB_PLATFORM,
    handle,
    accessToken,
    null,
    null,
  );
}

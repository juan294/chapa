import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { dbGetLinkedPlatformStrict, type StrictLinkedPlatform } from "@/lib/db/user-platforms";

export type SourceProvider = "github" | "gitlab" | "bitbucket" | "codeberg";
export type SourceAuthorization =
  | { status: "authorized"; subjectVersion: string; link: StrictLinkedPlatform | null }
  | { status: "disabled" | "unlinked" | "unavailable" };

/** Deliberately bypasses feature-flag caches, including their read backfills. */
export async function readSourceAuthorization(owner: string, provider: SourceProvider, requireSubject = true): Promise<SourceAuthorization> {
  try {
    const db = getSupabase();
    if (!db) return { status: "unavailable" };
    // `subjectVersion` tracks subject registration (publication consent is
    // retired, #1335 phase 2), so an in-flight comparison still detects the
    // one way this can now change: full account deletion followed by a
    // fresh re-registration.
    let subjectVersion = "legacy-unpublished";
    if (requireSubject) {
      const subject = await db.from("scoring_v7_subjects").select("created_at").eq("owner_handle", owner).maybeSingle();
      if (subject.error || typeof subject.data?.created_at !== "string") return { status: "unavailable" };
      subjectVersion = subject.data.created_at;
    }
    if (provider === "github") return { status: "authorized", subjectVersion, link: null };
    const flag = await db.from("feature_flags").select("enabled").eq("key", `${provider}_integration`).maybeSingle();
    if (flag.error || typeof flag.data?.enabled !== "boolean") return { status: "unavailable" };
    if (!flag.data.enabled) return { status: "disabled" };
    const linked = await dbGetLinkedPlatformStrict(owner, provider);
    if (linked.status !== "linked") return { status: linked.status === "unlinked" ? "unlinked" : "unavailable" };
    return { status: "authorized", subjectVersion, link: linked.link };
  } catch { return { status: "unavailable" }; }
}

export function sameSourceAuthorization(a: Extract<SourceAuthorization, { status: "authorized" }>, b: SourceAuthorization): boolean {
  return b.status === "authorized" && a.subjectVersion === b.subjectVersion && a.link?.id === b.link?.id &&
    a.link?.updatedAt === b.link?.updatedAt && a.link?.remoteLogin === b.link?.remoteLogin &&
    a.link?.tokens.accessToken === b.link?.tokens.accessToken;
}

import { getAvatarBase64 } from "./avatar";
import { TimeoutError, withTimeout } from "@/lib/async/with-timeout";

export type BadgeAvatarOutcome =
  | { status: "resolved"; dataUri: string }
  | { status: "definitive-absence" }
  | { status: "missing-url" }
  | { status: "transient-failure" }
  | { status: "timeout" };

export type BadgeAvatarCachePolicy = "standard" | "short" | "skip";

export async function resolveBadgeAvatar(
  handle: string,
  avatarUrl: string | null | undefined,
  options: { deadlineMs?: number } = {},
): Promise<BadgeAvatarOutcome> {
  if (!avatarUrl) return { status: "missing-url" };

  const fetchOutcome = getAvatarBase64(handle, avatarUrl)
    .then<BadgeAvatarOutcome>((dataUri) =>
      dataUri
        ? { status: "resolved", dataUri }
        : { status: "definitive-absence" },
    )
    .catch<BadgeAvatarOutcome>(() => ({ status: "transient-failure" }));

  if (options.deadlineMs === undefined) return fetchOutcome;

  try {
    return await withTimeout(
      fetchOutcome,
      options.deadlineMs,
      "badge avatar fetch",
    );
  } catch (error) {
    if (error instanceof TimeoutError) return { status: "timeout" };
    throw error;
  }
}

export function getBadgeAvatarDataUri(
  outcome: BadgeAvatarOutcome,
): string | undefined {
  return outcome.status === "resolved" ? outcome.dataUri : undefined;
}

export function getBadgeAvatarCachePolicy(
  outcome: BadgeAvatarOutcome,
): BadgeAvatarCachePolicy {
  if (outcome.status === "resolved" || outcome.status === "definitive-absence") {
    return "standard";
  }
  if (outcome.status === "missing-url") return "short";
  return "skip";
}

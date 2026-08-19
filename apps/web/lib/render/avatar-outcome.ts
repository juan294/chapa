import { getAvatarBase64 } from "./avatar";

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

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchOutcome,
      new Promise<BadgeAvatarOutcome>((resolve) => {
        timeoutId = setTimeout(
          () => resolve({ status: "timeout" }),
          options.deadlineMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
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

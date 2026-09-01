import { getOpenaiAppsChallengeToken } from "@/lib/env";

export function GET(): Response {
  const token = getOpenaiAppsChallengeToken();
  if (!token) return new Response("Not configured", { status: 404 });

  return new Response(token, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { getVercelEnv, getVercelGitCommitSha, getNodeEnv } from "@/lib/env";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const dynamic = "force-dynamic";

export const GET = withErrorCapture("/api/version", async () => {
  return NextResponse.json(
    {
      commitSha: getVercelGitCommitSha() ?? null,
      environment: getVercelEnv() ?? null,
      runtimeMode: getNodeEnv(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
});

import { createDisconnectHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const POST = withErrorCapture("/api/auth/bitbucket/disconnect", createDisconnectHandler(bitbucketOAuthConfig));

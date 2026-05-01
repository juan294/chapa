import { createConnectHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const GET = withErrorCapture("/api/auth/bitbucket/connect", createConnectHandler(bitbucketOAuthConfig));

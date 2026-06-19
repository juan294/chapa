import { createDisconnectHandler } from "@/lib/auth/platform-oauth";
import { gitlabOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const POST = withErrorCapture("/api/auth/gitlab/disconnect", createDisconnectHandler(gitlabOAuthConfig));

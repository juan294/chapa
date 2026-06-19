import { createStatusHandler } from "@/lib/auth/platform-oauth";
import { gitlabOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const GET = withErrorCapture("/api/auth/gitlab/status", createStatusHandler(gitlabOAuthConfig));

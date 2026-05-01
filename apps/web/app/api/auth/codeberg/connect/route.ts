import { createConnectHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const GET = withErrorCapture("/api/auth/codeberg/connect", createConnectHandler(codebergOAuthConfig));

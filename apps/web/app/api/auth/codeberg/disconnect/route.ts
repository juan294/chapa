import { createDisconnectHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const POST = withErrorCapture("/api/auth/codeberg/disconnect", createDisconnectHandler(codebergOAuthConfig));

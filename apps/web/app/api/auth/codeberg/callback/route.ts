import { createCallbackHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";
import { withErrorCapture } from "@/lib/analytics/server-errors";

export const GET = withErrorCapture("/api/auth/codeberg/callback", createCallbackHandler(codebergOAuthConfig));

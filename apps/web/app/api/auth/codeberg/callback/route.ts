import { createCallbackHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";

export const GET = createCallbackHandler(codebergOAuthConfig);

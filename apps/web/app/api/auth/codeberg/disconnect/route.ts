import { createDisconnectHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";

export const POST = createDisconnectHandler(codebergOAuthConfig);

import { createConnectHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";

export const GET = createConnectHandler(codebergOAuthConfig);

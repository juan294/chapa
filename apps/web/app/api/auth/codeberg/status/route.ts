import { createStatusHandler } from "@/lib/auth/platform-oauth";
import { codebergOAuthConfig } from "../config";

export const GET = createStatusHandler(codebergOAuthConfig);

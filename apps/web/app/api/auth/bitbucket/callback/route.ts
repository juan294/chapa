import { createCallbackHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";

export const GET = createCallbackHandler(bitbucketOAuthConfig);

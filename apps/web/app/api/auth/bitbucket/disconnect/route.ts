import { createDisconnectHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";

export const POST = createDisconnectHandler(bitbucketOAuthConfig);

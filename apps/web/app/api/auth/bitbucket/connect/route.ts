import { createConnectHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";

export const GET = createConnectHandler(bitbucketOAuthConfig);

import { createStatusHandler } from "@/lib/auth/platform-oauth";
import { bitbucketOAuthConfig } from "../config";

export const GET = createStatusHandler(bitbucketOAuthConfig);

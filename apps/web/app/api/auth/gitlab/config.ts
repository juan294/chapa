import { isGitlabEnabled } from "@/lib/feature-flags";
import {
  createGitlabStateCookie,
  buildGitlabAuthUrl,
  validateGitlabState,
  clearGitlabStateCookie,
  exchangeGitlabCode,
  fetchGitlabUser,
} from "@/lib/auth/gitlab";
import type { PlatformOAuthConfig } from "@/lib/auth/platform-oauth";

export const gitlabOAuthConfig: PlatformOAuthConfig = {
  platform: "gitlab",
  rateLimitPrefix: "gl",
  isEnabled: isGitlabEnabled,
  clientIdEnvVar: "GITLAB_CLIENT_ID",
  clientSecretEnvVar: "GITLAB_CLIENT_SECRET",
  createStateCookie: createGitlabStateCookie,
  buildAuthUrl: buildGitlabAuthUrl,
  validateState: validateGitlabState,
  clearStateCookie: clearGitlabStateCookie,
  exchangeCode: exchangeGitlabCode,
  fetchUser: fetchGitlabUser,
};

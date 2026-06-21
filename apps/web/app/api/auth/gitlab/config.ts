import { isGitlabEnabled } from "@/lib/feature-flags";
import { getGitlabClientId, getGitlabClientSecret } from "@/lib/env";
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
  getClientId: getGitlabClientId,
  getClientSecret: getGitlabClientSecret,
  createStateCookie: createGitlabStateCookie,
  buildAuthUrl: buildGitlabAuthUrl,
  validateState: validateGitlabState,
  clearStateCookie: clearGitlabStateCookie,
  exchangeCode: exchangeGitlabCode,
  fetchUser: fetchGitlabUser,
};

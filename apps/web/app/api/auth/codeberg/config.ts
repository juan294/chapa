import { isCodebergEnabled } from "@/lib/feature-flags";
import {
  createCodebergStateCookie,
  buildCodebergAuthUrl,
  validateCodebergState,
  clearCodebergStateCookie,
  exchangeCodebergCode,
  fetchCodebergUser,
} from "@/lib/auth/codeberg";
import type { PlatformOAuthConfig } from "@/lib/auth/platform-oauth";

export const codebergOAuthConfig: PlatformOAuthConfig = {
  platform: "codeberg",
  rateLimitPrefix: "cb",
  isEnabled: isCodebergEnabled,
  clientIdEnvVar: "CODEBERG_CLIENT_ID",
  clientSecretEnvVar: "CODEBERG_CLIENT_SECRET",
  createStateCookie: createCodebergStateCookie,
  buildAuthUrl: buildCodebergAuthUrl,
  validateState: validateCodebergState,
  clearStateCookie: clearCodebergStateCookie,
  exchangeCode: exchangeCodebergCode,
  fetchUser: fetchCodebergUser,
};

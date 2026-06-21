import { isCodebergEnabled } from "@/lib/feature-flags";
import { getCodebergClientId, getCodebergClientSecret } from "@/lib/env";
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
  getClientId: getCodebergClientId,
  getClientSecret: getCodebergClientSecret,
  createStateCookie: createCodebergStateCookie,
  buildAuthUrl: buildCodebergAuthUrl,
  validateState: validateCodebergState,
  clearStateCookie: clearCodebergStateCookie,
  exchangeCode: exchangeCodebergCode,
  fetchUser: fetchCodebergUser,
};

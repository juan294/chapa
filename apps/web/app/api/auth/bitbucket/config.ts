import { isBitbucketEnabled } from "@/lib/feature-flags";
import { getBitbucketClientId, getBitbucketClientSecret } from "@/lib/env";
import {
  createBitbucketStateCookie,
  buildBitbucketAuthUrl,
  validateBitbucketState,
  clearBitbucketStateCookie,
  exchangeBitbucketCode,
  fetchBitbucketUser,
} from "@/lib/auth/bitbucket";
import type { PlatformOAuthConfig, PlatformUser } from "@/lib/auth/platform-oauth";

export const bitbucketOAuthConfig: PlatformOAuthConfig = {
  platform: "bitbucket",
  rateLimitPrefix: "bb",
  isEnabled: isBitbucketEnabled,
  getClientId: getBitbucketClientId,
  getClientSecret: getBitbucketClientSecret,
  createStateCookie: createBitbucketStateCookie,
  buildAuthUrl: buildBitbucketAuthUrl,
  validateState: validateBitbucketState,
  clearStateCookie: clearBitbucketStateCookie,
  exchangeCode: exchangeBitbucketCode,
  fetchUser: async (accessToken: string): Promise<PlatformUser | null> => {
    const user = await fetchBitbucketUser(accessToken);
    if (!user) return null;
    // Map Bitbucket's "username" to the generic "login" field
    return { login: user.username };
  },
};

"use client";

import { createContext, useContext } from "react";
import {
  isBitbucketEnabledSync,
  isCodebergEnabledSync,
  isGitlabEnabledSync,
  isInsightsEnabledSync,
  isStudioEnabledSync,
  isWebmcpEnabledSync,
} from "@/lib/feature-flags-sync";

interface ClientFeatureFlags {
  studioEnabled: boolean;
  webmcpEnabled: boolean;
  insightsEnabled: boolean;
  bitbucketEnabled: boolean;
  codebergEnabled: boolean;
  gitlabEnabled: boolean;
}

const ClientFeatureFlagsContext = createContext<ClientFeatureFlags | null>(null);

export function ClientFeatureFlagsProvider({
  children,
  flags,
}: {
  children: React.ReactNode;
  flags: ClientFeatureFlags;
}) {
  return (
    <ClientFeatureFlagsContext.Provider value={flags}>
      {children}
    </ClientFeatureFlagsContext.Provider>
  );
}

export function useClientFeatureFlags(): ClientFeatureFlags {
  const flags = useContext(ClientFeatureFlagsContext);
  if (flags) return flags;

  return {
    studioEnabled: isStudioEnabledSync(),
    webmcpEnabled: isWebmcpEnabledSync(),
    insightsEnabled: isInsightsEnabledSync(),
    bitbucketEnabled: isBitbucketEnabledSync(),
    codebergEnabled: isCodebergEnabledSync(),
    gitlabEnabled: isGitlabEnabledSync(),
  };
}

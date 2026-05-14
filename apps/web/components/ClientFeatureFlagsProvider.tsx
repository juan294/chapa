"use client";

import { createContext, useContext } from "react";
import { isStudioEnabledSync } from "@/lib/feature-flags-sync";

interface ClientFeatureFlags {
  studioEnabled: boolean;
}

const ClientFeatureFlagsContext = createContext<ClientFeatureFlags | null>(null);

export function ClientFeatureFlagsProvider({
  children,
  studioEnabled,
}: {
  children: React.ReactNode;
  studioEnabled: boolean;
}) {
  return (
    <ClientFeatureFlagsContext.Provider value={{ studioEnabled }}>
      {children}
    </ClientFeatureFlagsContext.Provider>
  );
}

export function useClientFeatureFlags(): ClientFeatureFlags {
  const flags = useContext(ClientFeatureFlagsContext);
  if (flags) return flags;

  return { studioEnabled: isStudioEnabledSync() };
}

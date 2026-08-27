import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isStudioEnabled } from "@/lib/feature-flags";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { getPublicProfileVerification } from "@/lib/profile/public-profile";
import { loadStudioConfig } from "@/lib/db/studio";
import { Navbar } from "@/components/Navbar";
import { StudioClient } from "./StudioClient";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { getServerLocale, getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t('studio.metadataTitle') as string,
    description: t('studio.metadataDescription') as string,
    alternates: {
      canonical: "/studio",
    },
  };
}

export default async function StudioPage() {
  // Feature flag gate — redirect when studio is disabled
  if (!(await isStudioEnabled())) {
    redirect("/");
  }

  const session = getOptionalServerSessionFromHeaders(await headers());
  if (!session) {
    redirect("/api/auth/login");
  }

  const token = await getSessionGitHubToken(session);
  if (!token) {
    redirect("/api/auth/login");
  }

  // Fetch the live owner display projection and saved config in parallel.
  const [materialized, savedConfigResult] = await Promise.all([
    materializeDisplayProfile(session.login, { token }),
    loadStudioConfig(session.login),
  ]);

  if (!materialized) {
    throw new Error(`Unable to load Studio profile for ${session.login}`);
  }

  const verification = getPublicProfileVerification(materialized);
  const initialConfig = savedConfigResult.status === "found"
    ? savedConfigResult.config
    : DEFAULT_BADGE_CONFIG;

  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <Navbar
        navLinks={[
          { label: t('studio.navLinkStudio') as string, href: "/studio" },
          { label: t('studio.navLinkYourBadge') as string, href: `/u/${session.login}` },
        ]}
      />

      <div className="pt-[57px]">
        <KeyboardShortcutsListener />
        <StudioClient
          initialConfig={initialConfig}
          stats={materialized.stats}
          impact={materialized.displayImpact}
          craftResult={materialized.craftResult}
          handle={session.login}
          verification={verification}
        />
      </div>
    </main>
  );
}

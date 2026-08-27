import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  isStudioDemoEnabled,
  isStudioEnabled,
} from "@/lib/feature-flags";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { materializeDisplayProfile } from "@/lib/profile/materialize-profile";
import { getPublicProfileVerification } from "@/lib/profile/public-profile";
import { loadStudioConfig } from "@/lib/db/studio";
import { Navbar } from "@/components/Navbar";
import { StudioClient, type StudioClientProps } from "./StudioClient";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { getSessionGitHubToken } from "@/lib/auth/github-session-token";
import { KeyboardShortcutsListener } from "@/components/KeyboardShortcutsListener";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { DEMO_IMPACT, DEMO_STATS } from "@/lib/render/demoData";

export const dynamic = "force-dynamic";

interface StudioPageProps {
  searchParams?: Promise<{ demo?: string | string[] }>;
}

export async function generateMetadata(
  { searchParams }: StudioPageProps = {},
): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const isDemo = params.demo === "1"
    && await isStudioEnabled()
    && await isStudioDemoEnabled();
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t('studio.metadataTitle') as string,
    description: t('studio.metadataDescription') as string,
    alternates: {
      canonical: "/studio",
    },
    ...(isDemo ? { robots: { index: false, follow: false } } : {}),
  };
}

async function renderStudio(clientProps: StudioClientProps) {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  const handle = clientProps.handle ?? clientProps.stats.handle;

  return (
    <main id="main-content" className="min-h-screen bg-bg">
      <Navbar
        navLinks={[
          { label: t('studio.navLinkStudio') as string, href: "/studio" },
          { label: t('studio.navLinkYourBadge') as string, href: `/u/${handle}` },
        ]}
      />

      <div className="pt-[57px]">
        <KeyboardShortcutsListener />
        <StudioClient
          key={clientProps.demo ? "demo" : "live"}
          {...clientProps}
        />
      </div>
    </main>
  );
}

export default async function StudioPage(
  { searchParams }: StudioPageProps = {},
) {
  // Feature flag gate — redirect when studio is disabled
  if (!(await isStudioEnabled())) {
    redirect("/");
  }

  const params = searchParams ? await searchParams : {};
  if (params.demo === "1" && await isStudioDemoEnabled()) {
    return renderStudio({
      initialConfig: DEFAULT_BADGE_CONFIG,
      stats: DEMO_STATS,
      impact: DEMO_IMPACT,
      craftResult: null,
      handle: DEMO_STATS.handle,
      verification: null,
      demo: true,
    });
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

  return renderStudio({
    initialConfig,
    stats: materialized.stats,
    impact: materialized.displayImpact,
    craftResult: materialized.craftResult,
    handle: session.login,
    verification,
  });
}

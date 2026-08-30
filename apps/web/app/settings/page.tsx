import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getOptionalServerSessionFromHeaders } from "@/lib/auth/session";
import { DynamicRouteShell } from "@/components/DynamicRouteShell";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { SettingsClient } from "./SettingsClient";

// Session-gated like /studio, not a public content page (#1223): it reads the
// session from request headers, so it can never be statically rendered.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = getServerT(locale);
  return {
    title: t("settings.metadataTitle") as string,
    description: t("settings.metadataDescription") as string,
    alternates: { canonical: "/settings" },
    // Account pages have nothing to offer a crawler and everything to leak.
    robots: { index: false, follow: false },
  };
}

export default async function SettingsPage() {
  const session = getOptionalServerSessionFromHeaders(await headers());
  if (!session) {
    redirect("/api/auth/login");
  }

  const locale = await getServerLocale();
  const t = getServerT(locale);

  return (
    // #1194 — the shell supplies the navbar AND the two locale corrections
    // the static root layout cannot make. Before it, this route rendered in
    // DEFAULT_LOCALE for every visitor regardless of their cookie or header.
    <DynamicRouteShell
      locale={locale}
      navLinks={[
        {
          label: t("settings.navLinkYourBadge") as string,
          href: `/u/${session.login}`,
        },
      ]}
    >
      <main id="main-content" className="min-h-screen bg-bg">
        <div className="pt-[57px]">
          <SettingsClient
            login={session.login}
            name={session.name ?? null}
            avatarUrl={session.avatar_url ?? null}
          />
        </div>
      </main>
    </DynamicRouteShell>
  );
}

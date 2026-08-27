import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getOptionalServerSessionFromHeaders,
  getSessionSecret,
} from "@/lib/auth/session";
import { getBaseUrl } from "@/lib/env";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { LocaleSync } from "@/lib/i18n";
import { cacheGet } from "@/lib/cache/redis";
import { cliDeviceContextKey, type CliDeviceContext } from "@/lib/auth/cli-token";
import { AuthorizeClient } from "./AuthorizeClient";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ session?: string; lang?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  return {
    title: t('cliAuthorize.metadataTitle') as string,
    robots: { index: false },
  };
}

export default async function CliAuthorizePage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = params.session;
  const locale = await getServerLocale(params.lang);
  const t = getServerT(locale);

  if (!sessionId) {
    return (
      <>
        <LocaleSync queryLang={params.lang} />
        <main id="main-content" className="flex min-h-screen items-center justify-center bg-bg px-6">
          <div className="w-full max-w-md rounded-xl border border-stroke bg-card p-8">
            <h1 className="font-heading text-xl font-bold text-text-primary mb-4">
              {t('cliAuthorize.h1') as string}
            </h1>
            <p className="text-terminal-red font-heading text-sm">
              {t('cliAuthorize.errorMissingSession') as string}
            </p>
          </div>
        </main>
      </>
    );
  }

  // Check if user is logged in
  if (!getSessionSecret()) {
    redirect("/");
  }

  const session = getOptionalServerSessionFromHeaders(await headers());

  if (!session) {
    // Redirect to login, then back here
    const baseUrl = getBaseUrl();
    const returnUrl = `${baseUrl}/cli/authorize?session=${encodeURIComponent(sessionId)}`;
    redirect(`/api/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
  }

  // SE-H1 interim mitigation (#1174): surface the initiating device's IP and
  // user-agent (captured by the poll route at session creation) so a user
  // approving a request they did not themselves initiate has a visible
  // signal. Best-effort read — null (session predates this change, expired,
  // or Redis unavailable) just means the page shows no device details.
  const deviceContext = await cacheGet<CliDeviceContext>(
    cliDeviceContextKey(sessionId),
  );

  return (
    <>
      <LocaleSync queryLang={params.lang} />
      <AuthorizeClient
        sessionId={sessionId}
        handle={session.login}
        deviceContext={deviceContext}
      />
    </>
  );
}

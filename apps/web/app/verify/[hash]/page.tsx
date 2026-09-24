import { getReceiptVerificationV7 } from "@/lib/verification/store";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusCallout } from "@/components/StatusCallout";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { tArray } from "@/lib/i18n/typed-accessors";
import {
  LangSync,
  LocaleSync,
  type Locale,
  type Translations,
} from "@/lib/i18n";
import { DynamicRouteShell } from "@/components/DynamicRouteShell";
import type { NavLinkItem } from "@/components/NavbarShell";
import { isWebmcpEnabled } from "@/lib/feature-flags";
import type { Metadata } from "next";
import { VerifyPageWebMcpTools } from "./VerifyPageWebMcpTools";
import { VERIFICATION_CODE_PATTERN, parseVerificationTokenV7 } from "@/lib/verification/constants";

import { ReceiptCard } from "./ReceiptCard";

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}

function queryLocale(lang: string | string[] | undefined): string | undefined {
  return typeof lang === "string" ? lang : undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: VerifyPageProps): Promise<Metadata> {
  const { hash } = await params;
  const { lang: rawLang } = await searchParams;
  const lang = queryLocale(rawLang);
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  return {
    title: VERIFICATION_CODE_PATTERN.test(hash)
      ? `${t('verify.title') as string} ${hash}`
      : t('verifyDetail.invalidHashTitle') as string,
    description: t('verify.description') as string,
    robots: { index: false },
  };
}

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { hash } = await params;
  const { lang: rawLang } = await searchParams;
  const lang = queryLocale(rawLang);
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  // #1167 (UX-B1) — real routes (/about, /about/scoring, /verify), NOT the
  // landing page's `landing.navLinks` hash anchors, which are meaningless
  // off that page.
  const innerNavLinks = tArray<{ label: string; href: string }>(t, "nav.innerLinks");

  if (!VERIFICATION_CODE_PATTERN.test(hash)) {
    return (
      <VerifyLocaleBoundary
        locale={locale}
        navLinks={innerNavLinks}
        queryLang={lang}
        t={t}
      >
        <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32">
          <InvalidHashCard hash={hash} t={t} />
        </main>
      </VerifyLocaleBoundary>
    );
  }

  if (parseVerificationTokenV7(hash)) {
    let result;
    try { result = await getReceiptVerificationV7(hash); }
    catch { result = "unavailable" as const; }
    const webmcpEnabled = await isWebmcpEnabled();
    return (
      <VerifyLocaleBoundary locale={locale} navLinks={innerNavLinks} queryLang={lang} t={t}>
        <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32 pb-16">
          <ReceiptCard token={hash} result={result} t={t} />
          {webmcpEnabled && result && result !== "unavailable" && <VerifyPageWebMcpTools hash={hash} isV7={true} />}
        </main>
      </VerifyLocaleBoundary>
    );
  }

  // #1335 phase 5 — every well-formed non-v7 hash reaching here matched
  // VERIFICATION_CODE_PATTERN above, so it is a retired v6 verification
  // code, not a lookup miss. `verification_records` no longer exists.
  const webmcpEnabled = await isWebmcpEnabled();

  return (
    <VerifyLocaleBoundary
      locale={locale}
      navLinks={innerNavLinks}
      queryLang={lang}
      t={t}
    >
      <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32 pb-16">
        {webmcpEnabled && <VerifyPageWebMcpTools hash={hash} isV7={false} />}
        <RetiredV6Card hash={hash} t={t} />
      </main>
    </VerifyLocaleBoundary>
  );
}

/**
 * #1194 — this used to hand-assemble DocumentLocaleScript + LanguageProvider
 * itself, a third copy of the same three-part correction. It now wraps
 * `DynamicRouteShell` and keeps only what is specific to this page: the
 * locale sync leaves, the page frame and the footer.
 */
function VerifyLocaleBoundary({
  children,
  locale,
  navLinks,
  queryLang,
  t,
}: {
  children: React.ReactNode;
  locale: Locale;
  navLinks?: NavLinkItem[];
  queryLang?: string;
  t: TFunc;
}) {
  return (
    <DynamicRouteShell locale={locale} navLinks={navLinks}>
      <LangSync />
      <LocaleSync queryLang={queryLang} />
      <div className="min-h-screen bg-bg text-text-primary">
        {children}
        {/* #1167 (UX-B1) — no fixed-bottom command bar exists on this page,
            so no bottom spacer is needed before the footer. */}
        <SiteFooter t={t} />
      </div>
    </DynamicRouteShell>
  );
}

type TFunc = (key: string) => string | string[] | string[][] | Translations | Translations[];

/** #1335 phase 5 — a well-formed pre-v7 hash is terminal, not a lookup miss:
 * `verification_records` no longer exists, so there is nothing left to find. */
function RetiredV6Card({ hash, t }: { hash: string; t: TFunc }) {
  return (
    <StatusCallout
      variant="warning"
      title={t('verifyDetail.retiredTitle') as string}
      titleAs="h1"
      description={t('verifyDetail.retiredDescription') as string}
    >
      <div className="rounded-[3px] border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{t('verifyDetail.hashLabel') as string}</p>
        <p className="break-all font-heading text-lg tracking-widest text-text-secondary">
          {hash}
        </p>
      </div>
    </StatusCallout>
  );
}

function InvalidHashCard({ hash, t }: { hash: string; t: TFunc }) {
  return (
    <StatusCallout
      variant="error"
      title={t('verifyDetail.invalidHashTitle') as string}
      titleAs="h1"
      description={t('verifyDetail.invalidHashDescription') as string}
    >
      <div className="rounded-[3px] border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{t('verifyDetail.provided') as string}</p>
        <p className="break-all font-heading text-sm text-terminal-red">{hash}</p>
      </div>
    </StatusCallout>
  );
}

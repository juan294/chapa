import { getVerificationRecord } from "@/lib/verification/store";
import { Navbar } from "@/components/Navbar";
import { StatusCallout } from "@/components/StatusCallout";
import { getServerLocale, getServerT } from "@/lib/i18n";
import type { Translations } from "@/lib/i18n";
import Link from "next/link";
import type { Metadata } from "next";

const HASH_PATTERN = /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})$/;

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: Promise<{ hash: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: VerifyPageProps): Promise<Metadata> {
  const { hash } = await params;
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);
  return {
    title: HASH_PATTERN.test(hash)
      ? `${t('verify.title') as string} ${hash} — Chapa`
      : `${t('verifyDetail.invalidHashTitle') as string} — Chapa`,
    description: t('verify.description') as string,
    robots: { index: false },
  };
}

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { hash } = await params;
  const { lang } = await searchParams;
  const locale = await getServerLocale(lang);
  const t = getServerT(locale);

  if (!HASH_PATTERN.test(hash)) {
    return (
      <div className="min-h-screen bg-bg text-text-primary">
        <Navbar />
        <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32">
          <InvalidHashCard hash={hash} t={t} />
        </main>
      </div>
    );
  }

  const record = await getVerificationRecord(hash);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32 pb-16">
        {record ? (
          <VerifiedCard hash={hash} record={record} t={t} />
        ) : (
          <NotFoundCard hash={hash} t={t} />
        )}
      </main>
    </div>
  );
}

type TFunc = (key: string) => string | string[] | Translations[];

function VerifiedCard({
  hash,
  record,
  t,
}: {
  hash: string;
  record: {
    handle: string;
    displayName?: string;
    adjustedComposite: number;
    confidence: number;
    tier: string;
    archetype: string;
    dimensions: {
      delivery: number;
      quality: number;
      consistency: number;
      breadth: number;
    };
    commitsTotal: number;
    prsMergedCount: number;
    reviewsSubmittedCount: number;
    generatedAt: string;
    profileType: string;
  };
  t: TFunc;
}) {
  return (
    <StatusCallout
      variant="verification"
      title={t('verifyDetail.verifiedTitle') as string}
      titleAs="h1"
      description={t('verifyDetail.verifiedDescription') as string}
    >
      {/* Hash display */}
      <div className="mb-6 rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{t('verifyDetail.verificationCode') as string}</p>
        <p className="font-heading text-lg tracking-widest text-complement">
          {hash}
        </p>
      </div>

      {/* Profile info */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{t('verifyDetail.developer') as string}</span>
          <Link
            href={`/u/${record.handle}`}
            className="font-heading text-sm text-complement hover:text-complement-light"
          >
            @{record.handle}
          </Link>
        </div>
        {record.displayName && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">{t('verifyDetail.name') as string}</span>
            <span className="text-sm text-text-primary">
              {record.displayName}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{t('verifyDetail.impactScore') as string}</span>
          <span className="font-heading text-sm font-bold text-text-primary">
            {record.adjustedComposite}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{t('verifyDetail.tier') as string}</span>
          <span className="text-sm text-text-primary">{record.tier}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{t('verifyDetail.archetype') as string}</span>
          <span className="text-sm text-text-primary">{record.archetype}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{t('verifyDetail.profile') as string}</span>
          <span className="text-sm capitalize text-text-primary">
            {record.profileType}
          </span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="mb-6">
        <h2 className="mb-2 font-heading text-xs font-medium uppercase tracking-wider text-text-secondary">
          {t('verifyDetail.dimensions') as string}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            Object.entries(record.dimensions) as [string, number][]
          ).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-stroke bg-bg px-3 py-2"
            >
              <p className="text-xs capitalize text-text-secondary">{key}</p>
              <p className="font-heading text-sm font-bold text-text-primary">
                {Math.round(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="mb-6">
        <h2 className="mb-2 font-heading text-xs font-medium uppercase tracking-wider text-text-secondary">
          {t('verifyDetail.keyMetrics') as string}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-stroke bg-bg px-3 py-2 text-center">
            <p className="font-heading text-sm font-bold text-text-primary">
              {record.commitsTotal}
            </p>
            <p className="text-xs text-text-secondary">Commits</p>
          </div>
          <div className="rounded-lg border border-stroke bg-bg px-3 py-2 text-center">
            <p className="font-heading text-sm font-bold text-text-primary">
              {record.prsMergedCount}
            </p>
            <p className="text-xs text-text-secondary">{t('verifyDetail.prsMerged') as string}</p>
          </div>
          <div className="rounded-lg border border-stroke bg-bg px-3 py-2 text-center">
            <p className="font-heading text-sm font-bold text-text-primary">
              {record.reviewsSubmittedCount}
            </p>
            <p className="text-xs text-text-secondary">{t('verifyDetail.reviews') as string}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-stroke pt-4">
        <p className="text-xs text-text-secondary">
          {t('verifyDetail.generatedOn') as string} {record.generatedAt}
        </p>
        <Link
          href={`/u/${record.handle}/badge.svg`}
          className="text-xs text-complement hover:text-complement-light"
        >
          {t('verifyDetail.viewBadge') as string}
        </Link>
      </div>
    </StatusCallout>
  );
}

function NotFoundCard({ hash, t }: { hash: string; t: TFunc }) {
  return (
    <StatusCallout
      variant="warning"
      title={t('verifyDetail.notFoundTitle') as string}
      titleAs="h1"
      description={t('verifyDetail.notFoundDescription') as string}
    >
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">Hash</p>
        <p className="font-heading text-lg tracking-widest text-text-secondary">
          {hash}
        </p>
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        {t('verifyDetail.notFoundExplanation') as string}
      </p>
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
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{t('verifyDetail.provided') as string}</p>
        <p className="font-heading text-sm text-terminal-red">{hash}</p>
      </div>
    </StatusCallout>
  );
}

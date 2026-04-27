import { getVerificationRecord } from "@/lib/verification/store";
import { Navbar } from "@/components/Navbar";
import { StatusCallout } from "@/components/StatusCallout";
import { SPANISH_PUBLIC_COPY } from "@/lib/copy/public-flow";
import Link from "next/link";
import type { Metadata } from "next";

const COPY = SPANISH_PUBLIC_COPY.verifyDetail;

const HASH_PATTERN = /^(?:[0-9a-f]{8}|[0-9a-f]{16}|[0-9a-f]{32})$/;

interface VerifyPageProps {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: HASH_PATTERN.test(hash)
      ? `Verificar insignia ${hash} — Chapa`
      : "Hash inválido — Chapa",
    description: "Verifica la autenticidad de cualquier insignia Chapa con su hash de verificación.",
    robots: { index: false },
  };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { hash } = await params;

  if (!HASH_PATTERN.test(hash)) {
    return (
      <div className="min-h-screen bg-bg text-text-primary">
        <Navbar />
        <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32">
          <InvalidHashCard hash={hash} />
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
          <VerifiedCard hash={hash} record={record} />
        ) : (
          <NotFoundCard hash={hash} />
        )}
      </main>
    </div>
  );
}

function VerifiedCard({
  hash,
  record,
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
}) {
  return (
    <StatusCallout
      variant="verification"
      title={COPY.verifiedTitle}
      titleAs="h1"
      description={COPY.verifiedDescription}
    >
      {/* Hash display */}
      <div className="mb-6 rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{COPY.verificationCode}</p>
        <p className="font-heading text-lg tracking-widest text-complement">
          {hash}
        </p>
      </div>

      {/* Profile info */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{COPY.developer}</span>
          <Link
            href={`/u/${record.handle}`}
            className="font-heading text-sm text-complement hover:text-complement-light"
          >
            @{record.handle}
          </Link>
        </div>
        {record.displayName && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">{COPY.name}</span>
            <span className="text-sm text-text-primary">
              {record.displayName}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{COPY.impactScore}</span>
          <span className="font-heading text-sm font-bold text-text-primary">
            {record.adjustedComposite}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{COPY.tier}</span>
          <span className="text-sm text-text-primary">{record.tier}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{COPY.archetype}</span>
          <span className="text-sm text-text-primary">{record.archetype}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">{COPY.profile}</span>
          <span className="text-sm capitalize text-text-primary">
            {record.profileType}
          </span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="mb-6">
        <h2 className="mb-2 font-heading text-xs font-medium uppercase tracking-wider text-text-secondary">
          {COPY.dimensions}
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
          {COPY.keyMetrics}
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
            <p className="text-xs text-text-secondary">{COPY.prsMerged}</p>
          </div>
          <div className="rounded-lg border border-stroke bg-bg px-3 py-2 text-center">
            <p className="font-heading text-sm font-bold text-text-primary">
              {record.reviewsSubmittedCount}
            </p>
            <p className="text-xs text-text-secondary">{COPY.reviews}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-stroke pt-4">
        <p className="text-xs text-text-secondary">
          {COPY.generatedOn} {record.generatedAt}
        </p>
        <Link
          href={`/u/${record.handle}/badge.svg`}
          className="text-xs text-complement hover:text-complement-light"
        >
          {COPY.viewBadge}
        </Link>
      </div>
    </StatusCallout>
  );
}

function NotFoundCard({ hash }: { hash: string }) {
  return (
    <StatusCallout
      variant="warning"
      title={COPY.notFoundTitle}
      titleAs="h1"
      description={COPY.notFoundDescription}
    >
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">Hash</p>
        <p className="font-heading text-lg tracking-widest text-text-secondary">
          {hash}
        </p>
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        {COPY.notFoundExplanation}
      </p>
    </StatusCallout>
  );
}

function InvalidHashCard({ hash }: { hash: string }) {
  return (
    <StatusCallout
      variant="error"
      title={COPY.invalidHashTitle}
      titleAs="h1"
      description={COPY.invalidHashDescription}
    >
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">{COPY.provided}</p>
        <p className="font-heading text-sm text-terminal-red">{hash}</p>
      </div>
    </StatusCallout>
  );
}

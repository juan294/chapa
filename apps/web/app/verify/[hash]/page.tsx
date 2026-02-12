import { getVerificationRecord } from "@/lib/verification/store";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import type { Metadata } from "next";

const HASH_PATTERN = /^[0-9a-f]{8}$/;

interface VerifyPageProps {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { hash } = await params;
  return {
    title: HASH_PATTERN.test(hash)
      ? `Verify Badge ${hash} — Chapa`
      : "Invalid Hash — Chapa",
    description: "Verify the authenticity of a Chapa developer impact badge.",
    robots: { index: false },
  };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { hash } = await params;

  if (!HASH_PATTERN.test(hash)) {
    return (
      <div className="min-h-screen bg-bg text-text-primary">
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 pt-32">
          <InvalidHashCard hash={hash} />
        </main>
      </div>
    );
  }

  const record = await getVerificationRecord(hash);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-32 pb-16">
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
      building: number;
      guarding: number;
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
    <div className="rounded-xl border border-stroke bg-card p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terminal-green/15">
          <svg
            className="h-5 w-5 text-terminal-green"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-terminal-green">
            Verified Badge
          </h1>
          <p className="text-sm text-text-secondary">
            This badge was generated from authentic GitHub data.
          </p>
        </div>
      </div>

      {/* Hash display */}
      <div className="mb-6 rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">Verification Code</p>
        <p className="font-heading text-lg tracking-widest text-[#E05A47]">
          {hash}
        </p>
      </div>

      {/* Profile info */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Developer</span>
          <Link
            href={`/u/${record.handle}`}
            className="font-heading text-sm text-amber hover:text-amber-light"
          >
            @{record.handle}
          </Link>
        </div>
        {record.displayName && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">Name</span>
            <span className="text-sm text-text-primary">
              {record.displayName}
            </span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Impact Score</span>
          <span className="font-heading text-sm font-bold text-text-primary">
            {record.adjustedComposite}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Confidence</span>
          <span className="text-sm text-text-primary">
            {record.confidence}%
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Tier</span>
          <span className="text-sm text-text-primary">{record.tier}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Archetype</span>
          <span className="text-sm text-text-primary">{record.archetype}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Profile</span>
          <span className="text-sm capitalize text-text-primary">
            {record.profileType}
          </span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
          Dimensions
        </p>
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
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
          Key Metrics
        </p>
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
            <p className="text-xs text-text-secondary">PRs Merged</p>
          </div>
          <div className="rounded-lg border border-stroke bg-bg px-3 py-2 text-center">
            <p className="font-heading text-sm font-bold text-text-primary">
              {record.reviewsSubmittedCount}
            </p>
            <p className="text-xs text-text-secondary">Reviews</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-stroke pt-4">
        <p className="text-xs text-text-secondary">
          Generated on {record.generatedAt}
        </p>
        <Link
          href={`/u/${record.handle}/badge.svg`}
          className="text-xs text-amber hover:text-amber-light"
        >
          View Badge
        </Link>
      </div>
    </div>
  );
}

function NotFoundCard({ hash }: { hash: string }) {
  return (
    <div className="rounded-xl border border-stroke bg-card p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terminal-yellow/15">
          <svg
            className="h-5 w-5 text-terminal-yellow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4m0 4h.01M12 2L2 20h20L12 2z" />
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-terminal-yellow">
            Not Found
          </h1>
          <p className="text-sm text-text-secondary">
            No verification record found for this hash.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">Hash</p>
        <p className="font-heading text-lg tracking-widest text-text-secondary">
          {hash}
        </p>
      </div>
      <p className="mt-4 text-sm text-text-secondary">
        This could mean the badge has expired (records are kept for 30 days) or
        the hash is incorrect.
      </p>
    </div>
  );
}

function InvalidHashCard({ hash }: { hash: string }) {
  return (
    <div className="rounded-xl border border-stroke bg-card p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terminal-red/15">
          <svg
            className="h-5 w-5 text-terminal-red"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6m0-6l6 6" />
          </svg>
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-terminal-red">
            Invalid Hash
          </h1>
          <p className="text-sm text-text-secondary">
            The verification hash must be exactly 8 hex characters.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-stroke bg-bg px-4 py-3">
        <p className="text-xs text-text-secondary">Provided</p>
        <p className="font-heading text-sm text-terminal-red">{hash}</p>
      </div>
    </div>
  );
}

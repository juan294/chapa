import { getStats90d } from "@/lib/github/client";
import { computeImpactV3 } from "@/lib/impact/v3";
import { ImpactBreakdown } from "@/components/ImpactBreakdown";
import { CopyButton } from "@/components/CopyButton";
import { ShareButton } from "@/components/ShareButton";
import { readSessionCookie } from "@/lib/auth/github";
import { isValidHandle } from "@/lib/validation";
import { Navbar } from "@/components/Navbar";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface SharePageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { handle } = await params;
  if (!isValidHandle(handle)) {
    return { title: "Not Found — Chapa" };
  }
  return {
    title: `@${handle} — Chapa Developer Impact`,
    description: `View ${handle}'s developer impact score and badge on Chapa.`,
    openGraph: {
      title: `@${handle} — Chapa Developer Impact`,
      description: `View ${handle}'s developer impact score and badge on Chapa.`,
      images: [`/u/${handle}/badge.svg`],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { handle } = await params;

  // Validate handle — return 404 for invalid handles (#13)
  if (!isValidHandle(handle)) {
    notFound();
  }

  // Read auth token from session cookie for better rate limits (#14)
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  let token: string | undefined;
  if (sessionSecret) {
    const headerStore = await headers();
    const session = readSessionCookie(
      headerStore.get("cookie"),
      sessionSecret,
    );
    if (session) token = session.token;
  }

  const stats = await getStats90d(handle, token);
  const impact = stats ? computeImpactV3(stats) : null;

  const embedMarkdown = `![Chapa Badge](https://chapa.thecreativetoken.com/u/${handle}/badge.svg)`;
  const embedHtml = `<img src="https://chapa.thecreativetoken.com/u/${handle}/badge.svg" alt="Chapa Badge for ${handle}" width="600" />`;

  return (
    <main id="main-content" className="min-h-screen bg-bg bg-grid-warm">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-amber/[0.03] blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-amber/[0.04] blur-[120px]" />
      </div>

      <Navbar />

      <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-16">
        {/* Handle */}
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-8 animate-fade-in-up [animation-delay:100ms]">
          <span className="text-amber">@{handle}</span>
        </h1>

        {/* Badge preview */}
        <div className="mb-12 animate-scale-in [animation-delay:200ms]">
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-4 animate-pulse-glow-amber">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/u/${encodeURIComponent(handle)}/badge.svg`}
              alt={`Chapa badge for ${handle}`}
              width={1200}
              height={630}
              className="w-full rounded-xl"
            />
          </div>
        </div>

        {/* Impact breakdown */}
        {impact ? (
          <section className="mb-12 animate-fade-in-up [animation-delay:300ms]">
            <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
              <h2 className="text-sm tracking-widest uppercase text-amber mb-6">
                Impact Breakdown
              </h2>
              <ImpactBreakdown impact={impact} />
            </div>
          </section>
        ) : (
          <section className="mb-12 animate-fade-in-up [animation-delay:300ms]">
            <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8">
              <p className="text-text-secondary">
                Could not load impact data for this user. Try again later.
              </p>
            </div>
          </section>
        )}

        {/* Embed snippets */}
        <section className="mb-12 animate-fade-in-up [animation-delay:400ms]">
          <div className="rounded-2xl border border-warm-stroke bg-warm-card/50 p-8 space-y-6">
            <h2 className="text-sm tracking-widest uppercase text-amber">
              Embed This Badge
            </h2>

            {/* Markdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Markdown</span>
                <CopyButton text={embedMarkdown} />
              </div>
              <pre className="overflow-x-auto rounded-xl border border-warm-stroke bg-[#0d0b08] p-4 text-sm text-text-secondary font-heading">
                {embedMarkdown}
              </pre>
            </div>

            {/* HTML */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">HTML</span>
                <CopyButton text={embedHtml} />
              </div>
              <pre className="overflow-x-auto rounded-xl border border-warm-stroke bg-[#0d0b08] p-4 text-sm text-text-secondary font-heading">
                {embedHtml}
              </pre>
            </div>
          </div>
        </section>

        {/* Share CTA */}
        <div className="flex items-center gap-4 animate-fade-in-up [animation-delay:500ms]">
          <ShareButton handle={handle} />
          <Link
            href="/"
            className="rounded-full border border-warm-stroke px-6 py-2.5 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04] transition-colors"
          >
            Generate yours
          </Link>
        </div>
      </div>
    </main>
  );
}

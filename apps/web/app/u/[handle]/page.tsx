interface SharePageProps {
  params: Promise<{ handle: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { handle } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 px-4 py-16">
      <h1 className="text-3xl font-bold">
        <span className="text-mint">@{handle}</span>
      </h1>

      {/* Badge preview */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/u/${encodeURIComponent(handle)}/badge.svg`}
        alt={`Chapa badge for ${handle}`}
        width={600}
        height={315}
        className="rounded-xl border border-stroke"
      />

      {/* Impact breakdown placeholder */}
      <section className="w-full max-w-xl space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">
          Impact Breakdown
        </h2>
        <p className="text-text-secondary">
          Score details and confidence reasons will appear here once the scoring
          pipeline is connected.
        </p>
      </section>

      {/* Embed snippet placeholder */}
      <section className="w-full max-w-xl space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">
          Embed this badge
        </h2>
        <pre className="overflow-x-auto rounded-lg bg-card p-4 text-sm text-text-secondary border border-stroke">
          {`![Chapa Badge](https://chapa.thecreativetoken.com/u/${handle}/badge.svg)`}
        </pre>
      </section>
    </main>
  );
}

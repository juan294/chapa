"use client";

import Link from "next/link";
import { StatusCallout } from "@/components/StatusCallout";
import { SPANISH_PUBLIC_COPY } from "@/lib/copy/public-flow";

const COPY = SPANISH_PUBLIC_COPY.errors;

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center"
    >
      <StatusCallout
        variant="error"
        title={COPY.general.title}
        titleAs="h1"
        description={COPY.general.description}
        className="w-full max-w-xl text-left"
      />
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="rounded-lg border border-terminal-red/30 bg-terminal-red/10 px-6 py-2.5 text-sm font-medium text-terminal-red transition-colors hover:bg-terminal-red/20"
        >
          {COPY.tryAgain}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-terminal-red/30 hover:text-text-primary"
        >
          {COPY.goHome}
        </Link>
      </div>
    </main>
  );
}

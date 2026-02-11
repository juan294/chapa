import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming Soon",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="max-w-md text-center">
        {/* Logo */}
        <h1 className="font-heading text-4xl font-bold tracking-tight text-text-primary">
          Chapa
          <span className="animate-cursor-blink text-amber">_</span>
        </h1>

        {/* Terminal prompt */}
        <div className="mt-8 font-heading text-sm">
          <p className="text-text-secondary">
            <span className="text-terminal-dim">$</span> chapa --status
          </p>
          <p className="mt-2 text-amber">&gt; Coming soon.</p>
        </div>

        {/* Tagline */}
        <p className="mt-6 text-sm leading-relaxed text-text-secondary">
          Developer impact badges, powered by GitHub.
        </p>
      </div>
    </main>
  );
}

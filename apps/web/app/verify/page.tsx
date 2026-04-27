import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { SPANISH_PUBLIC_COPY } from "@/lib/copy/public-flow";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = {
  title: SPANISH_PUBLIC_COPY.verify.title,
  description: SPANISH_PUBLIC_COPY.verify.description,
  robots: { index: false, follow: true },
};

export default function VerifyInputPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-2xl px-6 pt-32 pb-16">
        <div className="animate-fade-in-up">
          {/* Terminal command line */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa verify</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-6">
            <div>
              <h1 className="font-heading text-2xl tracking-tight">
                {SPANISH_PUBLIC_COPY.verify.headingBefore}{" "}
                <span className="text-complement">
                  {SPANISH_PUBLIC_COPY.verify.headingHighlight}
                </span>
              </h1>
              <p className="text-text-secondary text-sm mt-2">
                {SPANISH_PUBLIC_COPY.verify.instructions}
              </p>
            </div>

            <VerifyForm />
          </div>
        </div>
      </main>
    </div>
  );
}

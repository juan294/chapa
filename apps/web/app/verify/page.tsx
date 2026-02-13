import { Navbar } from "@/components/Navbar";
import { VerifyForm } from "./VerifyForm";

export default function VerifyInputPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main className="mx-auto max-w-2xl px-6 pt-32 pb-16">
        <div className="animate-fade-in-up">
          {/* Terminal command line */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa verify</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-6">
            <div>
              <h1 className="font-heading text-2xl tracking-tight">
                Verify a <span className="text-amber">Badge</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2">
                Enter the 8 or 16 character verification hash from any Chapa badge
                to confirm its authenticity. You can find it on the right edge
                of the badge.
              </p>
            </div>

            <VerifyForm />
          </div>
        </div>
      </main>
    </div>
  );
}

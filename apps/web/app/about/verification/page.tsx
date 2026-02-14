import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Badge Verification",
  description:
    "How Chapa badges are verified. Learn about the HMAC-SHA256 integrity system that proves badge data has not been tampered with.",
  openGraph: {
    title: "Chapa Badge Verification",
    description:
      "How the verification hash on every Chapa badge works — HMAC-SHA256, deterministic payloads, and what it guarantees.",
  },
  twitter: {
    card: "summary",
    title: "Chapa Badge Verification",
    description:
      "How the verification hash on every Chapa badge works.",
  },
};

/* ---------------------------------------------------------------------- */
/* Reusable sub-components                                                 */
/* ---------------------------------------------------------------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl sm:text-2xl font-semibold text-text-primary tracking-tight pt-8 pb-2">
      {children}
    </h2>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stroke">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left py-2 px-3 font-heading text-text-primary font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stroke/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 px-3 ${j === 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Icons                                                                   */
/* ---------------------------------------------------------------------- */

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm-1.5 14.5l-4-4 1.41-1.41L10.5 12.67l5.59-5.59L17.5 8.5l-7 7z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

export default function VerificationPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <main
        id="main-content"
        className="relative mx-auto max-w-3xl px-6 pt-32 pb-24"
      >
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4 animate-fade-in-up">
            Badge Verification
            <span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <p className="text-text-secondary text-lg mb-8 animate-fade-in-up [animation-delay:100ms]">
            Every Chapa badge carries a verification hash that proves the data
            has not been tampered with. Here is exactly how it works.
          </p>

          <div className="space-y-2 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {/* ---------------------------------------------------------- */}
            {/* Why verification exists                                     */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Why verification exists</SectionHeading>
            <p>
              Chapa badges are embeddable SVGs that live on READMEs, portfolios,
              and resumes. Because they display outside of Chapa, anyone could
              theoretically edit an SVG to inflate their score, change their
              archetype, or fabricate metrics. The verification hash makes that
              detectable.
            </p>
            <p>
              Every badge includes a short hex code on its right edge. That code
              is a cryptographic fingerprint of the badge data. Anyone can paste
              it into the{" "}
              <Link
                href="/verify"
                className="text-amber hover:text-amber-light transition-colors"
              >
                verification page
              </Link>{" "}
              to confirm the badge is authentic and see the original values.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* How it works                                                */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>How it works</SectionHeading>
            <p>
              The hash is generated using{" "}
              <strong className="text-text-primary">HMAC-SHA256</strong>, a
              widely used, industry-standard message authentication code. The
              process has three steps:
            </p>

            <ol className="list-decimal pl-6 space-y-3 my-4">
              <li>
                <strong className="text-text-primary">
                  Build a deterministic payload
                </strong>{" "}
                — the badge data fields are concatenated in a fixed order,
                separated by pipes. The same data always produces the same
                payload string.
              </li>
              <li>
                <strong className="text-text-primary">
                  Sign the payload
                </strong>{" "}
                — the payload is signed with a secret key that only the Chapa
                server knows. This produces a 64-character hex digest.
              </li>
              <li>
                <strong className="text-text-primary">
                  Truncate to 16 characters
                </strong>{" "}
                — the first 16 hex characters are used as the verification code.
                This is short enough to display on the badge while providing
                strong collision resistance.
              </li>
            </ol>

            <p>
              When a badge is generated, the verification record (hash +
              original data) is stored server-side. To verify, anyone can look
              up the hash and compare the stored values against what the badge
              displays.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What data is signed                                         */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>What data is signed</SectionHeading>
            <p>
              The HMAC payload includes every meaningful field displayed on the
              badge, in this exact order:
            </p>
            <Table
              headers={["Field", "Example", "Why included"]}
              rows={[
                ["Handle", "juan294", "Ties the badge to a specific developer"],
                [
                  "Adjusted composite",
                  "72",
                  "The headline impact score shown on the badge",
                ],
                [
                  "Confidence",
                  "85",
                  "Ensures confidence rating cannot be inflated",
                ],
                ["Tier", "High", "Prevents tier from being changed"],
                [
                  "Archetype",
                  "Builder",
                  "Locks the archetype label to the data",
                ],
                [
                  "Building",
                  "80",
                  "Each dimension score is individually signed",
                ],
                ["Guarding", "55", ""],
                ["Consistency", "68", ""],
                ["Breadth", "45", ""],
                [
                  "Total commits",
                  "312",
                  "Key metrics visible on the badge",
                ],
                ["PRs merged", "47", ""],
                ["Reviews submitted", "89", ""],
                [
                  "Date",
                  "2026-02-14",
                  "Same data on different days produces different hashes",
                ],
              ]}
            />
            <p>
              Floating-point dimension scores are rounded to integers before
              signing. Handles are lowercased. This ensures the payload is fully
              deterministic — the same badge data on the same day always produces
              the same hash.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What it guarantees                                          */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>What it guarantees</SectionHeading>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>
                <strong className="text-text-primary">Data integrity</strong> —
                if any field on the badge has been altered (score, tier,
                archetype, dimensions, metrics), the hash will not match and
                verification will fail.
              </li>
              <li>
                <strong className="text-text-primary">
                  Authenticity
                </strong>{" "}
                — only the Chapa server can produce a valid hash because only it
                knows the signing secret. No one else can forge a hash that
                passes verification.
              </li>
              <li>
                <strong className="text-text-primary">
                  Date binding
                </strong>{" "}
                — the date is part of the payload, so a valid hash from January
                cannot be reused in February. This ensures the verification
                reflects a specific point in time.
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* What it does not guarantee                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>What it does not guarantee</SectionHeading>
            <p>
              Transparency means being honest about limitations too:
            </p>
            <ul className="list-disc pl-6 space-y-2 my-4">
              <li>
                <strong className="text-text-primary">
                  Not a blockchain
                </strong>{" "}
                — verification records are stored in a database with a 30-day
                TTL. After 30 days, the record expires and the hash can no
                longer be verified. The badge itself remains valid; only the
                lookup expires.
              </li>
              <li>
                <strong className="text-text-primary">
                  Trust in Chapa
                </strong>{" "}
                — the system proves the badge was generated by Chapa and has not
                been modified since. It does not independently prove that the
                underlying GitHub data is accurate — it trusts GitHub as the
                data source.
              </li>
              <li>
                <strong className="text-text-primary">
                  Not tamper-proof at the SVG level
                </strong>{" "}
                — anyone can edit an SVG file. The hash does not prevent
                editing; it makes editing detectable. A modified badge will fail
                verification.
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* How to verify                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>How to verify a badge</SectionHeading>
            <ol className="list-decimal pl-6 space-y-2 my-4">
              <li>
                Find the 16-character hex code on the right edge of any Chapa
                badge.
              </li>
              <li>
                Go to the{" "}
                <Link
                  href="/verify"
                  className="text-amber hover:text-amber-light transition-colors"
                >
                  verification page
                </Link>{" "}
                and enter the code.
              </li>
              <li>
                The result will show the original badge data — compare it
                against what the badge displays.
              </li>
            </ol>
            <p>
              You can also use the API directly:{" "}
              <code className="font-heading text-text-primary/80 bg-amber/10 px-1.5 py-0.5 rounded text-xs">
                GET /api/verify/&lt;hash&gt;
              </code>{" "}
              returns a JSON response with the full verification record.
              Rate-limited to 30 requests per minute per IP.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Design decisions                                            */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Design decisions</SectionHeading>
            <Table
              headers={["Decision", "Rationale"]}
              rows={[
                [
                  "HMAC-SHA256",
                  "Industry standard, widely audited, and supported natively in Node.js. Security relies on key secrecy, not algorithm secrecy.",
                ],
                [
                  "16-character truncation",
                  "64 bits of the hash — strong collision resistance for this use case while remaining short enough to print on a badge.",
                ],
                [
                  "30-day TTL",
                  "Badges are regenerated daily. A 30-day window is generous for verification while keeping storage bounded.",
                ],
                [
                  "Fire-and-forget storage",
                  "If the database is temporarily unavailable, the badge still renders. Verification is a bonus, not a blocker.",
                ],
                [
                  "Date in payload",
                  "Prevents indefinite reuse of old hashes. Same developer, same data, different day = different hash.",
                ],
              ]}
            />

            {/* ---------------------------------------------------------- */}
            {/* CTA                                                         */}
            {/* ---------------------------------------------------------- */}
            <div className="mt-16 rounded-xl border border-stroke bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight mb-3">
                Try it yourself
              </h2>
              <p className="mb-4">
                Every Chapa badge has a verification hash. Paste it in to see
                the authenticated data behind any badge.
              </p>
              <Link
                href="/verify"
                className="group inline-flex items-center gap-2.5 rounded-lg bg-complement px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-complement/80 hover:shadow-xl hover:shadow-complement/25"
              >
                <ShieldCheckIcon className="w-4 h-4" />
                Verify a Badge
                <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <GlobalCommandBar />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isExperimentsEnabled } from "@/lib/feature-flags";

// Prevent static generation of experiment pages — they are feature-flagged
// and include heavy canvas/animation code that shouldn't be in the static build
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ExperimentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isExperimentsEnabled())) {
    notFound();
  }
  return <>{children}</>;
}

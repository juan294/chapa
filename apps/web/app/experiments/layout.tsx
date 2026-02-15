import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isExperimentsEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ExperimentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isExperimentsEnabled()) {
    notFound();
  }
  return <>{children}</>;
}

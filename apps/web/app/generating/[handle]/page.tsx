import { notFound } from "next/navigation";
import { isValidHandle } from "@/lib/validation";
import { SPANISH_PUBLIC_COPY } from "@/lib/copy/public-flow";
import { GeneratingProgress } from "./GeneratingProgress";
import type { Metadata } from "next";

interface GeneratingPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: GeneratingPageProps): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `${SPANISH_PUBLIC_COPY.generation.metadataTitle} — @${handle}`,
    robots: { index: false },
  };
}

export default async function GeneratingPage({ params }: GeneratingPageProps) {
  const { handle } = await params;

  if (!isValidHandle(handle)) {
    notFound();
  }

  return <GeneratingProgress handle={handle} />;
}

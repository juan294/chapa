"use client";

import dynamic from "next/dynamic";

const LottieExperimentPage = dynamic(
  () => import("./LottieExperimentClient"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          <p className="text-sm text-text-secondary">Loading Lottie experiment...</p>
        </div>
      </div>
    ),
  }
);

export default function LottieExperimentWrapper() {
  return <LottieExperimentPage />;
}

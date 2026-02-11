"use client";

type Intensity = "low" | "medium" | "high";
type ColorVariant = "amber" | "amber-white" | "amber-deep";
type Speed = "slow" | "medium" | "fast";

const INTENSITY_OPACITY: Record<Intensity, string> = {
  low: "opacity-[0.03]",
  medium: "opacity-[0.06]",
  high: "opacity-[0.10]",
};

const SPEED_DURATIONS: Record<Speed, { a1: string; a2: string; a3: string }> = {
  slow: { a1: "25s", a2: "30s", a3: "35s" },
  medium: { a1: "15s", a2: "20s", a3: "25s" },
  fast: { a1: "8s", a2: "10s", a3: "12s" },
};

const COLOR_BLOBS: Record<ColorVariant, [string, string, string]> = {
  amber: ["#7C6AEF", "#9D8FFF", "#5E4FCC"],
  "amber-white": ["#7C6AEF", "#9D8FFF", "#E0DBFF"],
  "amber-deep": ["#7C6AEF", "#9D8FFF", "#3D2F8C"],
};

export interface AuroraBackgroundProps {
  intensity?: Intensity;
  colorVariant?: ColorVariant;
  speed?: Speed;
  /** Use "absolute" for local positioning, "fixed" for full-page. Default: "absolute" */
  positioning?: "fixed" | "absolute";
}

export function AuroraBackground({
  intensity = "medium",
  colorVariant = "amber",
  speed = "medium",
  positioning = "absolute",
}: AuroraBackgroundProps) {
  const opacity = INTENSITY_OPACITY[intensity];
  const durations = SPEED_DURATIONS[speed];
  const [c1, c2, c3] = COLOR_BLOBS[colorVariant];

  const posClass = positioning === "fixed" ? "fixed inset-0" : "absolute inset-0";

  return (
    <>
      <style>{`
        @keyframes aurora-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(150px, -80px) rotate(45deg); }
          50% { transform: translate(80px, 120px) rotate(90deg); }
          75% { transform: translate(-60px, 60px) rotate(135deg); }
        }
        @keyframes aurora-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-120px, 80px) rotate(-60deg); }
          66% { transform: translate(60px, -100px) rotate(-120deg); }
        }
        @keyframes aurora-3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.3) rotate(30deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob { animation: none !important; }
        }
      `}</style>

      <div
        className={`${posClass} overflow-hidden pointer-events-none`}
        aria-hidden="true"
      >
        <div
          className={`aurora-blob absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c1,
            filter: "blur(150px)",
            animation: `aurora-1 ${durations.a1} ease-in-out infinite`,
          }}
        />
        <div
          className={`aurora-blob absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c2,
            filter: "blur(120px)",
            animation: `aurora-2 ${durations.a2} ease-in-out infinite`,
          }}
        />
        <div
          className={`aurora-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full ${opacity} will-change-transform`}
          style={{
            backgroundColor: c3,
            filter: "blur(180px)",
            animation: `aurora-3 ${durations.a3} ease-in-out infinite`,
          }}
        />
      </div>
    </>
  );
}

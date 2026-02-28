import { ScoreRingGauge } from "./ScoreRingGauge";
import { ScoreBoldNumber } from "./ScoreBoldNumber";
import { ScoreConcentricRings } from "./ScoreConcentricRings";
import type { ImpactV4Result } from "@chapa/shared";

interface HeroScoreZoneProps {
  variant: "ring" | "bold" | "rings";
  impact: ImpactV4Result;
  className?: string;
}

export function HeroScoreZone({ variant, impact, className }: HeroScoreZoneProps) {
  switch (variant) {
    case "ring":
      return <ScoreRingGauge impact={impact} className={className} />;
    case "bold":
      return <ScoreBoldNumber impact={impact} className={className} />;
    case "rings":
      return <ScoreConcentricRings impact={impact} className={className} />;
  }
}

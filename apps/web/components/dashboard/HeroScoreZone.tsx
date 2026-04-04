import { ScoreBoldNumber } from "./ScoreBoldNumber";
import type { ImpactV6Result } from "@chapa/shared";

interface HeroScoreZoneProps {
  impact: ImpactV6Result;
  className?: string;
}

export function HeroScoreZone({ impact, className }: HeroScoreZoneProps) {
  return <ScoreBoldNumber impact={impact} className={className} />;
}

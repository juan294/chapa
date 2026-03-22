import { ScoreBoldNumber } from "./ScoreBoldNumber";
import type { ImpactV4Result } from "@chapa/shared";

interface HeroScoreZoneProps {
  impact: ImpactV4Result;
  className?: string;
}

export function HeroScoreZone({ impact, className }: HeroScoreZoneProps) {
  return <ScoreBoldNumber impact={impact} className={className} />;
}

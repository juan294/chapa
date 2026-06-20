import { BadgeContent } from "@/components/badge/BadgeContent";
import { MOCK_STATS, MOCK_IMPACT } from "../../__fixtures__/mock-data";

/* ------------------------------------------------------------------ */
/*  Mock Badge Card                                                    */
/* ------------------------------------------------------------------ */

export function MockBadgeCard() {
  return (
    <div className="relative rounded-2xl border border-stroke bg-card/90 backdrop-blur-sm p-6 w-full max-w-sm">
      <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />
    </div>
  );
}

import { BadgeContent } from "@/components/badge/BadgeContent";
import { MOCK_STATS, MOCK_IMPACT } from "../../__fixtures__/mock-data";

/* ------------------------------------------------------------------ */
/*  Badge Card Component (reused across variants)                      */
/* ------------------------------------------------------------------ */
export function BadgeCard() {
  return <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />;
}

/* ------------------------------------------------------------------ */
/*  Compact Badge Card (for grid layout)                               */
/* ------------------------------------------------------------------ */
export function CompactBadgeCard() {
  return <BadgeContent stats={MOCK_STATS} impact={MOCK_IMPACT} />;
}

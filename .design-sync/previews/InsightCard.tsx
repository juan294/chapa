import { InsightCard } from "@chapa/web";

export const Trend = () => (
  <InsightCard insight={{
    id: "quality-trend", type: "trend", icon: "trending-up", dimension: "quality",
    headline: "Quality climbed 14 points this quarter",
    body: "More of your pull requests now land in the 20 to 500 line range, which is the band Chapa treats as reviewable.",
  }} />
);

export const NextTier = () => (
  <InsightCard insight={{
    id: "next-tier", type: "next-tier", icon: "target", dimension: "consistency",
    headline: "Six points from the next tier",
    body: "Raising Consistency to 80 would lift your composite from 80 to 84 and move you out of High.",
  }} />
);

export const Achievement = () => (
  <InsightCard insight={{
    id: "streak", type: "achievement", icon: "trophy", dimension: "delivery",
    headline: "Delivery is maxed at 100",
    body: "1,565 merged pull requests across 27 repositories in the last 12 months.",
  }} />
);

export const Tip = () => (
  <InsightCard insight={{
    id: "breadth-tip", type: "tip", icon: "lightbulb", dimension: "breadth",
    headline: "Spread work across more repositories",
    body: "Your top repository accounts for 20 percent of activity. Contributing to a wider set raises Breadth.",
  }} />
);

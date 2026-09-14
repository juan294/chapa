import { InsightCard } from "@chapa/web";

export const Trend = () => (
  <InsightCard insight={{
    id: "quality-trend", priority: 1, type: "trend", icon: "trending-up", dimension: "quality",
    headline: "Quality climbed 14 points this quarter",
    body: "More of your pull requests now land in the 20 to 500 line range, which is the band Chapa treats as reviewable.",
  }} />
);

export const NextTier = () => (
  <InsightCard insight={{
    id: "next-tier", priority: 2, type: "next-tier", icon: "target", dimension: "consistency",
    headline: "Five points from the next tier",
    body: "This illustrative profile is at 80. Elite begins at an adjusted score of 85.",
  }} />
);

export const Achievement = () => (
  <InsightCard insight={{
    id: "streak", priority: 3, type: "achievement", icon: "trophy", dimension: "delivery",
    headline: "Delivery is maxed at 100",
    body: "1,565 merged pull requests across 27 repositories in the last 12 months.",
  }} />
);

export const Tip = () => (
  <InsightCard insight={{
    id: "breadth-tip", priority: 4, type: "tip", icon: "lightbulb", dimension: "breadth",
    headline: "Spread work across more repositories",
    body: "Your top repository accounts for 20 percent of activity. Contributing to a wider set raises Breadth.",
  }} />
);

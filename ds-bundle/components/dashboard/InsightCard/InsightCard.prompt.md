InsightCard from @chapa/web. Use via `window.Chapa.InsightCard` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface InsightCardProps {
insight: {
    id: string;
    type: "trend" | "tip" | "achievement" | "next-tier";
    icon: "trending-up" | "trending-down" | "target" | "trophy" | "lightbulb" | "arrow-up";
    headline: string;
    body: string;
    dimension?: "delivery" | "quality" | "consistency" | "breadth" | "craft";
  };
  animationDelay?: number;
}
```

## Examples

### Trend

```jsx
() => (
  <InsightCard insight={{
    id: "quality-trend", type: "trend", icon: "trending-up", dimension: "quality",
    headline: "Quality climbed 14 points this quarter",
    body: "More of your pull requests now land in the 20 to 500 line range, which is the band Chapa treats as reviewable.",
  }} />
)
```

### NextTier

```jsx
() => (
  <InsightCard insight={{
    id: "next-tier", type: "next-tier", icon: "target", dimension: "consistency",
    headline: "Six points from the next tier",
    body: "Raising Consistency to 80 would lift your composite from 80 to 84 and move you out of High.",
  }} />
)
```

### Achievement

```jsx
() => (
  <InsightCard insight={{
    id: "streak", type: "achievement", icon: "trophy", dimension: "delivery",
    headline: "Delivery is maxed at 100",
    body: "1,565 merged pull requests across 27 repositories in the last 12 months.",
  }} />
)
```

### Tip

```jsx
() => (
  <InsightCard insight={{
    id: "breadth-tip", type: "tip", icon: "lightbulb", dimension: "breadth",
    headline: "Spread work across more repositories",
    body: "Your top repository accounts for 20 percent of activity. Contributing to a wider set raises Breadth.",
  }} />
)
```

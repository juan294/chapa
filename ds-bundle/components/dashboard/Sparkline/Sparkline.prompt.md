Sparkline from @chapa/web. Use via `window.Chapa.Sparkline` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface SparklineProps {
values: { date: string; value: number }[];
  width?: number;
  height?: number;
  color: string;
  className?: string;
}
```

## Examples

### Rising

```jsx
() => (
  <Sparkline values={trend} color="var(--color-dimension-delivery)" width={220} height={56} />
)
```

### Flat

```jsx
() => (
  <Sparkline values={flat} color="var(--color-dimension-consistency)" width={220} height={56} />
)
```

### Wide

```jsx
() => (
  <Sparkline values={trend} color="var(--color-amber)" width={420} height={72} />
)
```

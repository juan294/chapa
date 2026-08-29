CodebergIcon from @chapa/web. Use via `window.Chapa.CodebergIcon` (bundle loaded from the root `_ds_bundle.js`).

Codeberg mark (fill). Decorative — always `aria-hidden`.

## Props

```ts
interface CodebergIconProps {
className?: string;
}
```

## Examples

### Default

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 24, color: "var(--color-text-primary)" }}>
    <CodebergIcon className="w-4 h-4" />
    <CodebergIcon className="w-6 h-6" />
    <CodebergIcon className="w-10 h-10" />
  </div>
)
```

### OnAccent

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                background: "var(--color-amber-dark)", borderRadius: 8, color: "#fff", width: "fit-content" }}>
    <CodebergIcon className="w-5 h-5" />
    <span style={{ font: "600 14px/1 var(--font-body)" }}>CodebergIcon</span>
  </div>
)
```

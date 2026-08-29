CopyIcon from @chapa/web. Use via `window.Chapa.CopyIcon` (bundle loaded from the root `_ds_bundle.js`).

Clipboard / "copy" icon (stroke). Decorative — always `aria-hidden`.
Accepts standard SVG props (e.g. `className`, `width`, `height`) so call
sites can size it the same way they did with inline markup.

## Props

```ts
interface CopyIconProps {
className?: string;
}
```

## Examples

### Default

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 24, color: "var(--color-text-primary)" }}>
    <CopyIcon className="w-4 h-4" />
    <CopyIcon className="w-6 h-6" />
    <CopyIcon className="w-10 h-10" />
  </div>
)
```

### OnAccent

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                background: "var(--color-amber-dark)", borderRadius: 8, color: "#fff", width: "fit-content" }}>
    <CopyIcon className="w-5 h-5" />
    <span style={{ font: "600 14px/1 var(--font-body)" }}>CopyIcon</span>
  </div>
)
```

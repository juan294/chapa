ClaudeCodeStar from @chapa/web. Use via `window.Chapa.ClaudeCodeStar` (bundle loaded from the root `_ds_bundle.js`).

Animates the Claude Code attribution star in the footer by cycling through
star-shaped variants: * ✶ · ✦ (asterisk → six-pointed → dot → four-pointed)

Respects prefers-reduced-motion — stays on "*" when motion is reduced.

## Props

```ts
interface ClaudeCodeStarProps {
/** Decorative mark; takes no props. */
}
```

## Examples

### Mark

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24, color: "var(--color-text-primary)" }}>
    <ClaudeCodeStar />
    <span style={{ font: "500 15px/1.4 var(--font-body)" }}>Built with Claude Code</span>
  </div>
)
```

### OnDark

```jsx
() => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 24,
                background: "var(--color-dark-section)", borderRadius: 10, color: "#E2E4E9" }}>
    <ClaudeCodeStar />
    <span style={{ font: "500 15px/1.4 var(--font-body)" }}>Built with Claude Code</span>
  </div>
)
```

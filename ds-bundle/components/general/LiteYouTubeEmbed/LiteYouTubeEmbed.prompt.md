LiteYouTubeEmbed from @chapa/web. Use via `window.Chapa.LiteYouTubeEmbed` (bundle loaded from the root `_ds_bundle.js`).

Lightweight YouTube embed — renders a thumbnail + play button.
Only loads the heavy YouTube iframe when the user clicks play.
This keeps the page fast (avoids ~800KB iframe on initial load).

## Props

```ts
interface LiteYouTubeEmbedProps {
/** YouTube video ID (the part after v= in the URL) */
  videoId: string;
  /** Accessible title for the iframe and play button */
  title: string;
}
```

## Examples

### Facade

```jsx
() => (
  <div style={{ width: 480 }}>
    <LiteYouTubeEmbed videoId="aqz-KE-bpKQ" title="Chapa demo: developer impact, decoded" />
  </div>
)
```

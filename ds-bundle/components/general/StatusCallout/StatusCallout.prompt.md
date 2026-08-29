StatusCallout from @chapa/web. Use via `window.Chapa.StatusCallout` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface StatusCalloutProps {
variant: "success" | "error" | "warning" | "verification";
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  titleAs?: "h1" | "h2" | "h3" | "h4";
}
```

## Examples

### Verification

```jsx
() => (
  <StatusCallout
    variant="verification"
    title="Metrics verified"
    description="This badge was signed with HMAC-SHA256 on 29 August 2026. The signature proves the scores have not been altered since they were computed."
  />
)
```

### Success

```jsx
() => (
  <StatusCallout
    variant="success"
    title="Badge generated"
    description="Your Impact Profile is live. Embed it in a README with the snippet below."
  />
)
```

### Warning

```jsx
() => (
  <StatusCallout
    variant="warning"
    title="Private repository access is limited"
    description="Merges in private repositories are not visible to your session token, so Delivery may read lower than your real activity."
  />
)
```

### Error

```jsx
() => (
  <StatusCallout
    variant="error"
    title="Could not reach GitHub"
    description="GitHub returned a rate-limit response. Cached scores are being shown; try a refresh in a few minutes."
  />
)
```

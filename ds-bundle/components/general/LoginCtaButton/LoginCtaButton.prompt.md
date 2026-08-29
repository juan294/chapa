LoginCtaButton from @chapa/web. Use via `window.Chapa.LoginCtaButton` (bundle loaded from the root `_ds_bundle.js`).

Primary GitHub OAuth login CTA with an in-flight pending state (#770).

The login is a full-page redirect to `/api/auth/login`, so navigation
happens via the native anchor. On click we flip to a spinner + pending
label and block further clicks so the user gets immediate feedback while
the OAuth redirect is in flight.

## Props

```ts
interface LoginCtaButtonProps {
label: string;
  pendingLabel: string;
  size?: "sm" | "lg";
}
```

## Examples

### Small

```jsx
() => (
  <LoginCtaButton label="Get your badge" pendingLabel="Connecting to GitHub…" size="sm" />
)
```

### Large

```jsx
() => (
  <LoginCtaButton label="Get your badge" pendingLabel="Connecting to GitHub…" size="lg" />
)
```

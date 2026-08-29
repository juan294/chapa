ConfirmDialog from @chapa/web. Use via `window.Chapa.ConfirmDialog` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface ConfirmDialogProps {
open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

## Examples

### Destructive

```jsx
() => (
  <ConfirmDialog
    open
    variant="destructive"
    title="Delete your Chapa profile?"
    description="This removes your badge, your score history and every verification record. It cannot be undone."
    confirmLabel="Delete profile"
    cancelLabel="Keep it"
    onConfirm={noop}
    onCancel={noop}
  />
);

// NOTE: the component defaults to variant="destructive" (ConfirmDialog.tsx:23),
// so the non-destructive look only appears when "default" is passed explicitly.
```

### Default

```jsx
() => (
  <ConfirmDialog
    open
    variant="default"
    title="Save this badge configuration?"
    description="An agent proposed these style changes. Saving replaces your current preview configuration."
    confirmLabel="Save configuration"
    onConfirm={noop}
    onCancel={noop}
  />
)
```

### Loading

```jsx
() => (
  <ConfirmDialog
    open
    loading
    title="Recalculating your score"
    description="Chapa is refetching 12 months of activity across every linked platform."
    confirmLabel="Recalculate"
    onConfirm={noop}
    onCancel={noop}
  />
)
```

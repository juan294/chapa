import { ConfirmDialog } from "@chapa/web";

const noop = () => {};

export const Destructive = () => (
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
export const Default = () => (
  <ConfirmDialog
    open
    variant="default"
    title="Save this badge configuration?"
    description="An agent proposed these style changes. Saving replaces your current preview configuration."
    confirmLabel="Save configuration"
    onConfirm={noop}
    onCancel={noop}
  />
);

export const Loading = () => (
  <ConfirmDialog
    open
    loading
    title="Recalculating your score"
    description="Chapa is refetching 12 months of activity across every linked platform."
    confirmLabel="Recalculate"
    onConfirm={noop}
    onCancel={noop}
  />
);

import * as React from 'react';

/**
 * ConfirmDialog — from @chapa/web@2.24.1.
 */
export interface ConfirmDialogProps {
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

export declare const ConfirmDialog: React.ComponentType<ConfirmDialogProps>;

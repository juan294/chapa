import * as React from 'react';

/**
 * StatusCallout — from @chapa/web@2.24.1.
 */
export interface StatusCalloutProps {
variant: "success" | "error" | "warning" | "verification";
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
  titleAs?: "h1" | "h2" | "h3" | "h4";
}

export declare const StatusCallout: React.ComponentType<StatusCalloutProps>;

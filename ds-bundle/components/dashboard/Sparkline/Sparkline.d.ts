import * as React from 'react';

/**
 * Sparkline — from @chapa/web@2.24.1.
 */
export interface SparklineProps {
values: { date: string; value: number }[];
  width?: number;
  height?: number;
  color: string;
  className?: string;
}

export declare const Sparkline: React.ComponentType<SparklineProps>;

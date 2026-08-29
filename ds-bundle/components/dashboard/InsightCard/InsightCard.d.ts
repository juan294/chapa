import * as React from 'react';

/**
 * InsightCard — from @chapa/web@2.24.1.
 */
export interface InsightCardProps {
insight: {
    id: string;
    type: "trend" | "tip" | "achievement" | "next-tier";
    icon: "trending-up" | "trending-down" | "target" | "trophy" | "lightbulb" | "arrow-up";
    headline: string;
    body: string;
    dimension?: "delivery" | "quality" | "consistency" | "breadth" | "craft";
  };
  animationDelay?: number;
}

export declare const InsightCard: React.ComponentType<InsightCardProps>;

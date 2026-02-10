"use client";

export type ScoreEffect =
  | "standard"
  | "gold-shimmer"
  | "gold-leaf"
  | "chrome"
  | "embossed"
  | "neon-amber"
  | "holographic";

/** CSS for all text effects. Inject once in the page. */
export const SCORE_EFFECT_CSS = `
.te-gold-leaf {
  display: inline-block;
  background: linear-gradient(to bottom, #462523 0%, #CB9B51 22%, #F6E27A 45%, #F6F2C0 50%, #F6E27A 55%, #CB9B51 78%, #462523 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.te-chrome {
  display: inline-block;
  background: linear-gradient(to bottom, #7f8c8d 0%, #bdc3c7 25%, #ecf0f1 50%, #bdc3c7 75%, #7f8c8d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.te-embossed {
  color: rgba(226, 168, 75, 0.8);
  text-shadow: -1px -1px 1px rgba(255, 255, 255, 0.2), 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.te-gold-shimmer {
  display: inline-block;
  background: linear-gradient(90deg, #C28A2E 0%, #E2A84B 20%, #F6E27A 40%, #F6F2C0 50%, #F6E27A 60%, #E2A84B 80%, #C28A2E 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: te-shimmer 3s ease-in-out infinite;
}

@keyframes te-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.te-neon-amber {
  color: #E2A84B;
  text-shadow: 0 0 7px rgba(226, 168, 75, 0.5), 0 0 10px rgba(226, 168, 75, 0.4), 0 0 21px rgba(226, 168, 75, 0.3), 0 0 42px rgba(226, 168, 75, 0.2);
}

.te-holographic {
  display: inline-block;
  background: linear-gradient(90deg, #C28A2E, #E2A84B, #F6E27A, #F0C97D, #E2A84B, #F6E27A, #C28A2E);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: te-holo-shift 4s ease-in-out infinite;
}

@keyframes te-holo-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@media (prefers-reduced-motion: reduce) {
  .te-gold-shimmer, .te-holographic {
    animation: none !important;
    background-position: 50% 0;
  }
}
`;

export interface ScoreEffectTextProps {
  effect: ScoreEffect;
  children: React.ReactNode;
  className?: string;
}

export function ScoreEffectText({ effect, children, className = "" }: ScoreEffectTextProps) {
  if (effect === "standard") {
    return <span className={`text-amber ${className}`}>{children}</span>;
  }
  return (
    <span className={`te-${effect} ${className}`} aria-label={String(children)}>
      {children}
    </span>
  );
}

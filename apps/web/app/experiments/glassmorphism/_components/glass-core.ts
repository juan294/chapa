/* ------------------------------------------------------------------ */
/*  Glass style helpers                                                */
/* ------------------------------------------------------------------ */
export interface GlassConfig {
  bgOpacity: number;
  blur: number;
  saturation: number;
  borderOpacity: number;
  showBorder: boolean;
}

export function glassStyle(config: GlassConfig): React.CSSProperties {
  return {
    background: `rgba(19, 20, 30, ${config.bgOpacity})`,
    backdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
    WebkitBackdropFilter: `blur(${config.blur}px) saturate(${config.saturation}%)`,
    border: config.showBorder
      ? `1px solid rgba(27, 208, 147, ${config.borderOpacity})`
      : "1px solid transparent",
  };
}

/* ------------------------------------------------------------------ */
/*  Presets                                                            */
/* ------------------------------------------------------------------ */
export type GlassVariant = "light" | "medium" | "heavy" | "amber";

export const PRESETS: Record<
  GlassVariant,
  { label: string; description: string; bgOpacity: number; blur: number; saturation: number; borderOpacity: number; shadow?: string; insetHighlight?: boolean }
> = {
  light: {
    label: "Light Glass",
    description: "Subtle frosted effect. Low opacity, gentle blur. Best for overlaying colorful backgrounds.",
    bgOpacity: 0.4,
    blur: 12,
    saturation: 120,
    borderOpacity: 0.12,
  },
  medium: {
    label: "Medium Glass",
    description: "Balanced frosted glass. Good readability with visible depth. Default choice for cards.",
    bgOpacity: 0.6,
    blur: 20,
    saturation: 150,
    borderOpacity: 0.15,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  heavy: {
    label: "Heavy Glass",
    description: "Dense frosted glass with inset highlight. Strong blur, high contrast. Best for primary content.",
    bgOpacity: 0.75,
    blur: 30,
    saturation: 180,
    borderOpacity: 0.2,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    insetHighlight: true,
  },
  amber: {
    label: "Amber-Tinted Glass",
    description: "Warm amber-tinted transparent glass. Very low opacity with amber hue bleed-through.",
    bgOpacity: 0.08,
    blur: 16,
    saturation: 140,
    borderOpacity: 0.2,
  },
};

export function presetToStyle(variant: GlassVariant, showBorder: boolean): React.CSSProperties {
  const p = PRESETS[variant];
  const base: React.CSSProperties = {
    backdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    WebkitBackdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    border: showBorder
      ? `1px solid rgba(27, 208, 147, ${p.borderOpacity})`
      : "1px solid transparent",
  };

  // Amber variant uses amber-tinted background
  if (variant === "amber") {
    base.background = `rgba(27, 208, 147, ${p.bgOpacity})`;
  } else {
    base.background = `rgba(19, 20, 30, ${p.bgOpacity})`;
  }

  if (p.shadow) {
    base.boxShadow = p.shadow;
  }
  if (p.insetHighlight) {
    base.boxShadow = `${p.shadow || ""}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`.replace(/^, /, "");
  }

  return base;
}

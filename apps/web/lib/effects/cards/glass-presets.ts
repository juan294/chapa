export type GlassVariant = "frost" | "smoke" | "crystal" | "aurora-glass";

interface GlassPreset {
  label: string;
  bgOpacity: number;
  blur: number;
  saturation: number;
  borderOpacity: number;
  shadow?: string;
  insetHighlight?: boolean;
}

export const GLASS_PRESETS: Record<GlassVariant, GlassPreset> = {
  frost: {
    label: "Frost",
    bgOpacity: 0.4,
    blur: 12,
    saturation: 120,
    borderOpacity: 0.12,
  },
  smoke: {
    label: "Smoke",
    bgOpacity: 0.6,
    blur: 20,
    saturation: 150,
    borderOpacity: 0.15,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },
  crystal: {
    label: "Crystal",
    bgOpacity: 0.75,
    blur: 30,
    saturation: 180,
    borderOpacity: 0.2,
    shadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    insetHighlight: true,
  },
  "aurora-glass": {
    label: "Aurora Glass",
    bgOpacity: 0.08,
    blur: 16,
    saturation: 140,
    borderOpacity: 0.2,
  },
};

/** Generate CSS properties for a glass variant. */
export function glassStyle(variant: GlassVariant): React.CSSProperties {
  const p = GLASS_PRESETS[variant];
  const base: React.CSSProperties = {
    backdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    WebkitBackdropFilter: `blur(${p.blur}px) saturate(${p.saturation}%)`,
    border: `1px solid rgba(124, 106, 239, ${p.borderOpacity})`,
  };

  if (variant === "aurora-glass") {
    base.background = `rgba(124, 106, 239, ${p.bgOpacity})`;
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

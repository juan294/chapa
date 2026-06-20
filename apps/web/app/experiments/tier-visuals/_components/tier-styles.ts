/**
 * CSS for tier-specific visual effects (score text treatments, card borders,
 * elite animated gradient border, sparkle dots, reduced-motion fallbacks).
 *
 * SAFETY: CSS-only string literal with no user input — used for @keyframes and
 * tier-specific styles that cannot be expressed in Tailwind.
 */
export const TIER_VISUALS_CSS = `
/* ── Tier score text treatments ───────────────── */

/* Emerging: muted gray */
.tier-score-emerging {
  color: #9AA4B2;
}

/* Solid: white with subtle text shadow for depth */
.tier-score-solid {
  color: #E6EDF3;
  text-shadow: 0 1px 8px rgba(230,237,243,0.15);
}

/* High: static gold gradient text */
.tier-score-high {
  background: linear-gradient(135deg, var(--color-amber-dark), var(--color-amber), var(--color-amber-light), var(--color-amber), var(--color-amber-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Elite: animated gold shimmer text */
.tier-score-elite {
  background: linear-gradient(
    90deg,
    var(--color-amber-dark),
    var(--color-amber),
    #A99BFF,
    #D0C9FF,
    #A99BFF,
    var(--color-amber),
    var(--color-amber-dark)
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: tier-shimmer 3s ease-in-out infinite;
}

@keyframes tier-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Tier card border treatments ──────────────── */

/* Emerging: subtle gray static border */
.tier-card-emerging {
  border: 1px solid rgba(154,164,178,0.15);
}

/* Solid: subtle white static border */
.tier-card-solid {
  border: 1px solid rgba(230,237,243,0.12);
}

/* High: amber glow border */
.tier-card-high {
  border: 1px solid color-mix(in srgb, var(--color-amber) 18%, transparent);
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-amber) 10%, transparent), 0 0 40px color-mix(in srgb, var(--color-amber) 4%, transparent);
}

/* Elite: outer glow only (border handled by pseudo-element) */
.tier-card-elite {
  box-shadow:
    0 0 40px color-mix(in srgb, var(--color-amber) 15%, transparent),
    0 0 80px color-mix(in srgb, var(--color-amber) 5%, transparent);
}

/* ── Elite animated gradient border ───────────── */

@property --elite-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.elite-border-glow {
  background: conic-gradient(
    from var(--elite-angle),
    var(--color-amber-dark),
    var(--color-amber),
    var(--color-amber-light),
    var(--color-amber),
    var(--color-amber-dark),
    var(--color-amber),
    var(--color-amber-light),
    var(--color-amber),
    var(--color-amber-dark)
  );
  animation: elite-border-rotate 4s linear infinite;
  filter: blur(3px);
  opacity: 0.7;
}

@keyframes elite-border-rotate {
  0% { --elite-angle: 0deg; }
  100% { --elite-angle: 360deg; }
}

/* Fallback for browsers without @property */
@supports not (background: conic-gradient(from var(--elite-angle), red, blue)) {
  .elite-border-glow {
    background: linear-gradient(90deg, var(--color-amber-dark), var(--color-amber), var(--color-amber-light), var(--color-amber), var(--color-amber-dark));
    background-size: 300% 300%;
    animation: elite-border-fallback 3s ease infinite;
    filter: blur(3px);
    opacity: 0.7;
  }

  @keyframes elite-border-fallback {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
}

/* ── Elite tier pill gradient ─────────────────── */

.tier-elite-pill {
  background: linear-gradient(135deg, var(--color-amber-dark), var(--color-amber), var(--color-amber-light));
}

/* ── Sparkle dots ─────────────────────────────── */

.sparkle-dot {
  animation: sparkle-pulse 2s ease-in-out infinite;
}

@keyframes sparkle-pulse {
  0%, 100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.2);
  }
}

/* ── Reduced motion ───────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .tier-score-elite {
    animation: none !important;
    background-position: 0% 0%;
  }

  .elite-border-glow {
    animation: none !important;
    background: conic-gradient(
      from 45deg,
      var(--color-amber-dark),
      var(--color-amber),
      var(--color-amber-light),
      var(--color-amber),
      var(--color-amber-dark)
    );
  }

  .sparkle-dot {
    animation: none !important;
    opacity: 0.5;
    transform: scale(1);
  }
}
          `;
